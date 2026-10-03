import { buildFirmsUrl, redactFirmsUrl, type FirmsConfig } from "./config";
import { LiveSourceError, isAbort } from "./errors";

/**
 * NASA FIRMS adapter. FIRMS publishes satellite-observed THERMAL ANOMALIES (MODIS / VIIRS active-fire pixels). A record is
 * an observation of a hot pixel, not a confirmed fire; ThermoGuard's own rule-based layer interprets it downstream.
 * Endpoint: GET {base}/{MAP_KEY}/{SOURCE}/{west,south,east,north}/{1..5 days}, answered as CSV.
 */

export interface FirmsObservation {
  /** Deterministic: FIRMS-YYYYMMDD-{hash of the record identity}. The same record always yields the same ID. */
  id: string;
  lat: number; lon: number;
  /** Acquisition time, epoch milliseconds (UTC), and its ISO form. */
  t: number; iso: string;
  /** Acquisition calendar day, UTC, YYYY-MM-DD. */
  dayKey: string;
  satellite: string; instrument: string;
  frpMw: number; brightnessK: number;
  /** Percent for MODIS; null for VIIRS, which reports low / nominal / high. */
  confidence: number | null;
  confidenceLabel?: "low" | "nominal" | "high";
  dayNight: "D" | "N" | null;
}

export interface ParsedFirms {
  observations: FirmsObservation[];
  /** Data rows in the response. */
  records: number;
  /** Exact repeats of the same record (same position, time and sensor) that were collapsed. */
  duplicates: number;
  /** Rows dropped because a required field was missing or unparseable. Never silently invented. */
  skipped: number;
}

/** 53-bit string hash (cyrb53). Plenty of room for thousands of records per day with negligible collision odds. */
export function hash53(str: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Minimal CSV line splitter with quote support (FIRMS does not quote, but a stray quote must not shift columns). */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const SATELLITE_NAME: Record<string, string> = {
  n: "Suomi NPP", n20: "NOAA-20", "1": "NOAA-20", n21: "NOAA-21", t: "Terra", a: "Aqua", terra: "Terra", aqua: "Aqua",
};
const instrumentFromSource = (source: string) => (/^VIIRS/i.test(source) ? "VIIRS" : /^MODIS/i.test(source) ? "MODIS" : /^LANDSAT/i.test(source) ? "Landsat" : "Unknown");

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** Parses acq_date (YYYY-MM-DD) and acq_time (HHMM, UTC). Returns null for anything that is not a real timestamp. */
export function parseAcquisition(date: string, time: string): { t: number; iso: string; dayKey: string } | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const hm = /^\d{1,4}$/.exec(time) ? time.padStart(4, "0") : null;
  if (!d || !hm) return null;
  const [y, mo, da, hh, mi] = [Number(d[1]), Number(d[2]), Number(d[3]), Number(hm.slice(0, 2)), Number(hm.slice(2))];
  if (mo < 1 || mo > 12 || da < 1 || da > 31 || hh > 23 || mi > 59) return null;
  const t = Date.UTC(y, mo - 1, da, hh, mi);
  const back = new Date(t);
  if (back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== da) return null; // rejects 31 Feb and similar
  return { t, iso: back.toISOString(), dayKey: `${d[1]}-${d[2]}-${d[3]}` };
}

export function parseConfidence(raw: string): { confidence: number | null; label?: "low" | "nominal" | "high" } | null {
  const v = raw.trim().toLowerCase();
  if (v === "l" || v === "low") return { confidence: null, label: "low" };
  if (v === "n" || v === "nominal") return { confidence: null, label: "nominal" };
  if (v === "h" || v === "high") return { confidence: null, label: "high" };
  if (v !== "" && Number.isFinite(Number(v))) { const n = Number(v); return n >= 0 && n <= 100 ? { confidence: Math.round(n) } : null; }
  return null;
}

/** Throws LiveSourceError when the text is not a FIRMS CSV (an error page, a plain-text key error, or a dev-server HTML fallback). */
export function assertFirmsCsv(text: string): string[] {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const header = splitCsvLine(first).map((h) => h.toLowerCase());
  const ok = ["latitude", "longitude", "acq_date", "acq_time", "frp"].every((c) => header.includes(c)) && (header.includes("bright_ti4") || header.includes("brightness"));
  if (ok) return header;
  if (/invalid\s+map_key|map_key/i.test(text.slice(0, 300)))
    throw new LiveSourceError("auth", "NASA FIRMS did not accept the configured MAP_KEY.", text.slice(0, 160));
  throw new LiveSourceError("bad_response", "NASA FIRMS returned a response that is not thermal anomaly data.", text.slice(0, 160));
}

/**
 * Converts the CSV text into normalized observations. A header-only CSV is a valid, empty result (no detections in the
 * area and period), not an error. `source` is the FIRMS source name, used only to name the instrument when the column is absent.
 */
export function parseFirmsCsv(text: string, source: string): ParsedFirms {
  const header = assertFirmsCsv(text);
  const col = (name: string) => header.indexOf(name);
  const [iLat, iLon, iDate, iTime, iFrp, iSat, iInst, iConf, iDn] = ["latitude", "longitude", "acq_date", "acq_time", "frp", "satellite", "instrument", "confidence", "daynight"].map(col);
  const iBt = col("bright_ti4") >= 0 ? col("bright_ti4") : col("brightness");

  const lines = text.split(/\r?\n/).slice(1).filter((l) => l.trim() !== "");
  const seen = new Set<string>();
  const observations: FirmsObservation[] = [];
  let duplicates = 0, skipped = 0;

  for (const line of lines) {
    const f = splitCsvLine(line);
    const lat = Number(f[iLat]), lon = Number(f[iLon]), frp = f[iFrp] === "" ? NaN : Number(f[iFrp]), bt = f[iBt] === "" ? NaN : Number(f[iBt]);
    const acq = parseAcquisition(f[iDate] ?? "", f[iTime] ?? "");
    const conf = iConf >= 0 ? parseConfidence(f[iConf] ?? "") : null;
    // Required fields must be present and plausible. Nothing is invented to fill a gap.
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || !acq
      || !Number.isFinite(frp) || frp < 0 || !Number.isFinite(bt) || bt <= 0 || !conf) { skipped++; continue; }

    const satRaw = iSat >= 0 ? (f[iSat] ?? "") : "";
    const satellite = SATELLITE_NAME[satRaw.toLowerCase()] ?? (satRaw || "Unknown satellite");
    const instrument = (iInst >= 0 && f[iInst]) || instrumentFromSource(source);
    // Identity: position rounded to ~11 m, acquisition date and time, satellite and instrument. Nearby distinct pixels survive.
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}|${f[iDate]}|${(f[iTime] ?? "").padStart(4, "0")}|${satRaw}|${instrument}`;
    if (seen.has(key)) { duplicates++; continue; }
    seen.add(key);
    const dn = iDn >= 0 ? (f[iDn] ?? "").toUpperCase() : "";
    observations.push({
      id: `FIRMS-${acq.dayKey.replace(/-/g, "")}-${hash53(key)}`, lat, lon, t: acq.t, iso: acq.iso, dayKey: acq.dayKey,
      satellite, instrument, frpMw: Math.round(frp * 10) / 10, brightnessK: Math.round(bt * 10) / 10,
      confidence: conf.confidence, confidenceLabel: conf.label, dayNight: dn === "D" || dn === "N" ? dn : null,
    });
  }
  return { observations, records: lines.length, duplicates, skipped };
}

export interface FetchOptions { signal?: AbortSignal; fetchImpl?: typeof fetch; timeoutMs?: number }

/** One FIRMS request. Failures are converted to LiveSourceError with a safe message; technical detail goes to the console only. */
export async function fetchFirmsCsv(cfg: FirmsConfig, opts: FetchOptions = {}): Promise<string> {
  if (!cfg.configured)
    throw new LiveSourceError("not_configured", "NASA FIRMS is not configured. A free FIRMS MAP_KEY is required for live data.");
  const doFetch = opts.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, opts.timeoutMs ?? 30_000);
  const onAbort = () => ctrl.abort();
  opts.signal?.addEventListener("abort", onAbort);
  try {
    const res = await doFetch(buildFirmsUrl(cfg), { signal: ctrl.signal });
    if (res.status === 400 || res.status === 401 || res.status === 403)
      throw new LiveSourceError("auth", "NASA FIRMS did not accept the request. Check the MAP_KEY and the configured area.", `HTTP ${res.status}`);
    if (res.status === 429) throw new LiveSourceError("rate_limited", "NASA FIRMS is rate limiting requests. Try again in a few minutes.", "HTTP 429");
    if (!res.ok) throw new LiveSourceError("http", "NASA FIRMS could not be reached right now.", `HTTP ${res.status}`);
    return await res.text();
  } catch (e) {
    if (e instanceof LiveSourceError) { console.warn("[ThermoGuard] FIRMS request failed:", redactFirmsUrl(cfg), e.detail ?? e.message); throw e; }
    if (isAbort(e)) {
      if (timedOut) throw new LiveSourceError("timeout", "NASA FIRMS did not respond in time.", "timeout");
      throw e; // cancelled by the caller: not a data failure
    }
    // Offline, DNS failure, blocked cross-origin request (CORS) and CORS-less error responses all surface as a TypeError.
    console.warn("[ThermoGuard] FIRMS request could not be completed (offline, blocked by CORS, or network error):", redactFirmsUrl(cfg), e);
    throw new LiveSourceError("network", "NASA FIRMS data could not be loaded. The request was blocked or the network is unavailable.", String(e));
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
  }
}
