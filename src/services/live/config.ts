import type { DataMode } from "@/types";

/**
 * Phase 3C configuration. Everything is read from Vite environment variables so nothing is hard-coded and no secret
 * lives in source. NOTE: any `VITE_*` variable is embedded in the browser bundle. A FIRMS MAP_KEY is a free,
 * low-sensitivity key, but if you deploy publicly prefer the proxy option (see README), which keeps the key server-side.
 */

export interface BBox { west: number; south: number; east: number; north: number }
export interface RegionConfig { label: string; bbox: BBox }

/** Western / Central India: Gujarat, Maharashtra, Goa and the western part of Madhya Pradesh, covering the demo region. */
export const DEFAULT_REGION: RegionConfig = { label: "Western / Central India", bbox: { west: 68, south: 15.5, east: 81, north: 25 } };

export const FIRMS_DIRECT_BASE_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv";
export const DEFAULT_OVERPASS_URL = "https://overpass-api.de/api/interpreter";
/** The FIRMS area API accepts a day range of 1 to 5. */
export const FIRMS_MAX_DAY_RANGE = 5;
export const DEFAULT_FIRMS_SOURCE = "VIIRS_SNPP_NRT";

type EnvRecord = Record<string, string | undefined>;
/** `import.meta.env` is undefined outside Vite (for example under unit tests), so it is read defensively. */
export function readEnv(): EnvRecord {
  const vite = (import.meta as unknown as { env?: EnvRecord }).env;
  // `__THERMOGUARD_ENV__` is a test hook for running the pipeline in Node (scripts/validate-live.ts); the browser never sets it.
  return (vite ?? (globalThis as { __THERMOGUARD_ENV__?: EnvRecord }).__THERMOGUARD_ENV__ ?? {}) as EnvRecord;
}

const clean = (v: string | undefined) => (v ?? "").trim();

export function parseBBox(raw: string): BBox | null {
  const p = raw.split(",").map((x) => Number(x.trim()));
  if (p.length !== 4 || p.some((x) => !Number.isFinite(x))) return null;
  const [west, south, east, north] = p;
  if (west < -180 || east > 180 || south < -90 || north > 90 || west >= east || south >= north) return null;
  return { west, south, east, north };
}
export const bboxToString = (b: BBox) => `${b.west},${b.south},${b.east},${b.north}`;

export interface FirmsConfig {
  baseUrl: string;
  /** null when no key is embedded in the browser (proxy mode, or not configured). */
  mapKey: string | null;
  source: string;
  dayRange: number;
  region: RegionConfig;
  /** True when a request can plausibly succeed: a key is present, or a non-NASA base URL (a proxy) is configured. */
  configured: boolean;
  usesProxy: boolean;
  /** Configuration problems that were corrected (for example an invalid bounding box). Shown as a notice, never thrown. */
  warnings: string[];
}

export function readFirmsConfig(env: EnvRecord = readEnv()): FirmsConfig {
  const warnings: string[] = [];
  const mapKey = clean(env.VITE_FIRMS_MAP_KEY) || clean(env.VITE_FIRMS_API_KEY) || null;
  const baseUrl = (clean(env.VITE_FIRMS_BASE_URL) || FIRMS_DIRECT_BASE_URL).replace(/\/+$/, "");
  const usesProxy = baseUrl !== FIRMS_DIRECT_BASE_URL;

  let region = DEFAULT_REGION;
  const rawBox = clean(env.VITE_FIRMS_BBOX);
  if (rawBox) {
    const box = parseBBox(rawBox);
    if (box) region = { label: clean(env.VITE_FIRMS_REGION_LABEL) || "Configured region", bbox: box };
    else warnings.push("VITE_FIRMS_BBOX is not a valid west,south,east,north box, so the default region is used.");
  } else if (clean(env.VITE_FIRMS_REGION_LABEL)) region = { ...DEFAULT_REGION, label: clean(env.VITE_FIRMS_REGION_LABEL) };

  const rawDays = Number(clean(env.VITE_FIRMS_DAY_RANGE));
  let dayRange = 5;
  if (clean(env.VITE_FIRMS_DAY_RANGE)) {
    if (Number.isInteger(rawDays) && rawDays >= 1) dayRange = Math.min(rawDays, FIRMS_MAX_DAY_RANGE);
    else warnings.push("VITE_FIRMS_DAY_RANGE is not a whole number from 1 to 5, so 5 days is used.");
    if (rawDays > FIRMS_MAX_DAY_RANGE) warnings.push("The FIRMS area API allows at most 5 days per request, so 5 days is used.");
  }

  return {
    baseUrl, mapKey, source: clean(env.VITE_FIRMS_SOURCE) || DEFAULT_FIRMS_SOURCE, dayRange, region,
    configured: !!mapKey || usesProxy, usesProxy, warnings,
  };
}

/** `/{key?}/{SOURCE}/{west,south,east,north}/{days}`. The key is only added when it is embedded in the browser. */
export function buildFirmsUrl(cfg: FirmsConfig): string {
  const parts = [cfg.baseUrl, ...(cfg.mapKey ? [encodeURIComponent(cfg.mapKey)] : []), encodeURIComponent(cfg.source), bboxToString(cfg.region.bbox), String(cfg.dayRange)];
  return parts.join("/");
}
/** The same URL with the key masked, safe for logs and error messages. */
export const redactFirmsUrl = (cfg: FirmsConfig) => buildFirmsUrl({ ...cfg, mapKey: cfg.mapKey ? "***" : null });

export function readOverpassUrl(env: EnvRecord = readEnv()): string {
  return clean(env.VITE_OVERPASS_URL) || DEFAULT_OVERPASS_URL;
}

/**
 * Which data the user asked for. Priority: `?mode=live|demo` in the URL, then `VITE_DATA_MODE`, then live when FIRMS is
 * configured, otherwise demo, so a fresh checkout with no configuration always opens on the demonstration dataset.
 */
export function resolveRequestedMode(search: string, env: EnvRecord = readEnv()): DataMode {
  const q = new URLSearchParams(search).get("mode");
  if (q === "live" || q === "demo") return q;
  const e = clean(env.VITE_DATA_MODE).toLowerCase();
  if (e === "live" || e === "demo") return e;
  return readFirmsConfig(env).configured ? "live" : "demo";
}

/** Development helpers (same spirit as the existing `?simulateError`): force a failure path without touching the network. */
export interface SimulationFlags { firmsError: boolean; osmError: boolean; empty: boolean }
export function readSimulation(search: string): SimulationFlags {
  const p = new URLSearchParams(search);
  return { firmsError: p.has("simulateFirmsError"), osmError: p.has("simulateOsmError"), empty: p.has("simulateEmpty") };
}
