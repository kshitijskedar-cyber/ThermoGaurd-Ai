import type { Facility, LiveStatus, ThermalDataset } from "@/types";
import { readFirmsConfig, readOverpassUrl, readSimulation, bboxToString, type FirmsConfig } from "./config";
import { LiveSourceError, isAbort } from "./errors";
import { fetchFirmsCsv, parseFirmsCsv } from "./firms";
import { buildLiveEvents } from "./firmsEvents";
import { fetchOsmFacilities, tileKeyOf, type OsmResult } from "./overpass";

/**
 * Live data pipeline:  NASA FIRMS -> observations -> ThermoGuard events -> OSM/Overpass facilities -> ThermalDataset.
 * It returns the SAME ThermalDataset shape as the demo service, so the existing analysis, alerts, analytics, sites,
 * investigation and reports run unchanged. It throws LiveSourceError only when FIRMS itself fails; an OSM failure is
 * a degraded-but-usable result (live thermal data without facility context).
 */

export interface LiveLoadOptions { force?: boolean; signal?: AbortSignal; fetchImpl?: typeof fetch; now?: number; search?: string }

const FIRMS_CACHE_MS = 5 * 60_000;
let firmsCache: { key: string; t: number; csv: string } | null = null;
let inflight: Promise<ThermalDataset> | null = null;
export const resetLiveCaches = () => { firmsCache = null; inflight = null; };

const searchString = (o: LiveLoadOptions) => o.search ?? (typeof window !== "undefined" ? window.location.search : "");

async function firmsCsv(cfg: FirmsConfig, o: LiveLoadOptions, now: number): Promise<string> {
  if (readSimulation(searchString(o)).firmsError) throw new LiveSourceError("network", "NASA FIRMS data could not be loaded (simulated failure).", "simulateFirmsError");
  const key = `${cfg.baseUrl}|${cfg.source}|${bboxToString(cfg.region.bbox)}|${cfg.dayRange}`;
  if (!o.force && firmsCache && firmsCache.key === key && now - firmsCache.t < FIRMS_CACHE_MS) return firmsCache.csv;
  const csv = await fetchFirmsCsv(cfg, { signal: o.signal, fetchImpl: o.fetchImpl });
  firmsCache = { key, t: now, csv };
  return csv;
}

async function run(o: LiveLoadOptions): Promise<ThermalDataset> {
  const cfg = readFirmsConfig();
  const sim = readSimulation(searchString(o));
  const now = o.now ?? Date.now();
  const messages: string[] = [...cfg.warnings];

  // ---- 1. NASA FIRMS (failure here fails the whole live load; the caller falls back to demo data)
  const csv = await firmsCsv(cfg, o, now);
  const parsed = parseFirmsCsv(csv, cfg.source);
  if (parsed.skipped) messages.push(`${parsed.skipped} FIRMS ${parsed.skipped === 1 ? "record was" : "records were"} skipped because required fields were missing.`);
  const built = buildLiveEvents(sim.empty ? [] : parsed.observations, { now, dayRange: cfg.dayRange });
  const newest = parsed.observations.reduce<string | null>((m, x) => (!m || x.iso > m ? x.iso : m), null);

  // ---- 2. OpenStreetMap / Overpass context for the places where events actually are (failure here is non-fatal)
  let osm: OsmResult | null = null;
  let facilitiesOk: boolean | null = null;
  if (built.events.length) {
    try {
      if (sim.osmError) throw new LiveSourceError("network", "OpenStreetMap context could not be loaded (simulated failure).", "simulateOsmError");
      osm = await fetchOsmFacilities(built.events, readOverpassUrl(), { signal: o.signal, fetchImpl: o.fetchImpl, now });
      facilitiesOk = true;
      if (osm.tilesSkipped > 0)
        messages.push(`OpenStreetMap context covers the ${osm.tilesQueried} busiest 0.25° areas; ${osm.tilesSkipped} further ${osm.tilesSkipped === 1 ? "area was" : "areas were"} not queried.`);
    } catch (e) {
      if (isAbort(e)) throw e;
      facilitiesOk = false;
      messages.push(e instanceof LiveSourceError ? e.userMessage : "OpenStreetMap context could not be loaded.");
      if (!(e instanceof LiveSourceError)) console.warn("[ThermoGuard] Unexpected OSM error:", e);
    }
  }
  const facilities: Facility[] = osm?.facilities ?? [];
  const events = osm ? built.events.map((e) => ({ ...e, osmCovered: osm!.covered.has(tileKeyOf(e.lat, e.lon)) })) : built.events;

  const live: LiveStatus = {
    requested: "live", thermalOk: true, facilitiesOk, messages, fetchedAt: new Date(now).toISOString(),
    firms: {
      source: cfg.source, bbox: bboxToString(cfg.region.bbox), regionLabel: cfg.region.label, dayRange: cfg.dayRange,
      records: parsed.records, duplicatesRemoved: parsed.duplicates, skipped: parsed.skipped, locations: built.events.length, newestObservation: newest,
    },
    osm: osm ? { elements: osm.elements, tilesQueried: osm.tilesQueried, tilesSkipped: osm.tilesSkipped, endpoint: osm.endpoint } : undefined,
  };
  return {
    mode: "live",
    sourceLabel: facilitiesOk ? "NASA FIRMS thermal anomalies + OpenStreetMap context" : "NASA FIRMS thermal anomalies",
    referenceTime: live.fetchedAt!, events, facilities, history: built.history, historyWindowDays: cfg.dayRange,
    sources: { thermal: "NASA FIRMS", facilities: facilitiesOk ? "OpenStreetMap" : "Unavailable", history: "FIRMS" },
    live,
  };
}

/** Concurrent callers share one in-flight request, so repeated renders or double clicks never duplicate network traffic. */
export function loadLiveDataset(opts: LiveLoadOptions = {}): Promise<ThermalDataset> {
  if (inflight) return inflight;
  const p = run(opts).finally(() => { if (inflight === p) inflight = null; });
  inflight = p;
  return p;
}
