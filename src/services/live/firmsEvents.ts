import type { Observation, ThermalEvent } from "@/types";
import { haversineKm } from "@/services/geospatial/geo";
import type { FirmsObservation } from "./firms";

/**
 * Observation -> ThermoGuard event model.
 *
 * The existing application models one ThermalEvent per monitored location with a per-day observation history. A FIRMS
 * response is a list of individual pixel detections, so repeated detections at the same place on different days must be
 * grouped, otherwise one steady flare would appear as five separate "events" and persistence could never be measured.
 *
 * Rules (all deterministic):
 *  - Detections within CLUSTER_KM of a location's anchor belong to that location. The anchor is its most recent detection
 *    (ties: the strongest FRP), so every event IS a real FIRMS record with its own measured values.
 *  - History is built ONLY from detections that exist in the fetched FIRMS window (at most 5 days). A day without a
 *    detection is shown as "no detection": it can mean no heat or no usable overpass (for example cloud). Nothing is simulated.
 */

export const CLUSTER_KM = 1;
const CELL_DEG = 0.02;
const DAY_MS = 864e5;

export const dayKeyOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (key: string, n: number) => dayKeyOf(Date.parse(`${key}T00:00:00Z`) + n * DAY_MS);

interface Cluster { anchor: FirmsObservation; members: FirmsObservation[] }

/** 0.5 degree grid cell label. FIRMS carries no place name and no reverse geocoder is used, so the cell is the honest region. */
export function gridRegion(lat: number, lon: number): string {
  const rng = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(1)}–${Math.abs(v + 0.5).toFixed(1)}°${v >= 0 ? pos : neg}`;
  return `${rng(Math.floor(lat * 2) / 2, "N", "S")} · ${rng(Math.floor(lon * 2) / 2, "E", "W")}`;
}

export interface BuiltEvents {
  events: ThermalEvent[];
  history: Record<string, Observation[]>;
  windowStart: string; // YYYY-MM-DD (UTC)
  windowEnd: string;
  windowDays: number;
}

export function buildLiveEvents(observations: FirmsObservation[], opts: { now: number; dayRange: number }): BuiltEvents {
  const sorted = [...observations].sort((a, b) => b.t - a.t || b.frpMw - a.frpMw || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // ---- group into locations with a coarse spatial hash (3 x 3 cell neighbourhood covers CLUSTER_KM at any latitude below 60°)
  const grid = new Map<string, Cluster[]>();
  const clusters: Cluster[] = [];
  const cellOf = (v: number) => Math.floor(v / CELL_DEG);
  for (const o of sorted) {
    const ci = cellOf(o.lat), cj = cellOf(o.lon);
    let home: Cluster | null = null;
    for (let di = -1; di <= 1 && !home; di++)
      for (let dj = -1; dj <= 1 && !home; dj++)
        for (const c of grid.get(`${ci + di}:${cj + dj}`) ?? [])
          if (haversineKm(o.lat, o.lon, c.anchor.lat, c.anchor.lon) <= CLUSTER_KM) { home = c; break; }
    if (home) { home.members.push(o); continue; }
    const c: Cluster = { anchor: o, members: [o] };
    clusters.push(c);
    const k = `${ci}:${cj}`;
    const list = grid.get(k);
    if (list) list.push(c); else grid.set(k, [c]);
  }

  // ---- the history window: the FIRMS day range ending today (or on the newest observation if the clock is behind)
  const newest = observations.reduce((m, o) => (o.dayKey > m ? o.dayKey : m), "");
  const today = dayKeyOf(opts.now);
  const windowEnd = newest && newest > today ? newest : today;
  const windowStart = addDays(windowEnd, -(opts.dayRange - 1));

  const events: ThermalEvent[] = [];
  const history: Record<string, Observation[]> = {};
  const usedIds = new Set<string>();

  for (const { anchor: a, members } of clusters) {
    let id = a.id;
    for (let n = 2; usedIds.has(id); n++) id = `${a.id}-${n}`; // practically unreachable; keeps IDs unique and stable
    usedIds.add(id);

    const maxFrpByDay = new Map<string, number>();
    for (const m of members) maxFrpByDay.set(m.dayKey, Math.max(maxFrpByDay.get(m.dayKey) ?? 0, m.frpMw));

    // Days from the start of the window to the event's own day (the engine treats the last entry as the event itself).
    const dayKeys: string[] = [];
    for (let k = a.dayKey < windowStart ? a.dayKey : windowStart; k <= a.dayKey; k = addDays(k, 1)) dayKeys.push(k);
    const obs: Observation[] = dayKeys.map((k, i) => {
      const f = maxFrpByDay.get(k);
      const isEventDay = k === a.dayKey;
      return { day: i + 1, date: `${k}T12:00:00.000Z`, active: f != null, frpMw: isEventDay ? a.frpMw : f != null ? Math.round(f * 10) / 10 : null };
    });
    history[id] = obs;

    events.push({
      id, lat: a.lat, lon: a.lon, detectedAt: a.iso, satellite: a.satellite, instrument: a.instrument,
      frpMw: a.frpMw, brightnessK: a.brightnessK, confidence: a.confidence, confidenceLabel: a.confidenceLabel, source: "firms",
      // Placeholders: analyseDataset() replaces classification and risk with the engine's assessment.
      classification: "unknown", risk: "low", status: "active",
      persistenceActive: obs.filter((o) => o.active).length, persistenceTotal: obs.length, region: gridRegion(a.lat, a.lon),
    });
  }
  events.sort((x, y) => Date.parse(y.detectedAt) - Date.parse(x.detectedAt) || (x.id < y.id ? -1 : 1));
  return { events, history, windowStart, windowEnd, windowDays: opts.dayRange };
}
