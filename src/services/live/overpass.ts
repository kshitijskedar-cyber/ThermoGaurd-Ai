import type { Facility, FacilityType } from "@/types";
import { LiveSourceError, isAbort } from "./errors";

/**
 * OpenStreetMap / Overpass adapter. It supplies GEOSPATIAL INFRASTRUCTURE CONTEXT only: industrial land use, works,
 * power plants and quarries mapped by volunteers. An OSM object is not proof of an operating facility, OSM coverage is
 * uneven, and operating status is never available, so none is shown or invented.
 *
 * Query design: one POST containing a union of small bounding boxes ("tiles"), built from the actual FIRMS event
 * locations, never one continent-sized query and never one query per event.
 */

export const TILE_DEG = 0.25; // ~28 km
/** Tile padding in degrees (~6.7 km): a facility within the engine's 5 km proximity range of an event is always inside its tile. */
export const PAD_DEG = 0.06;
export const MAX_TILES = 48;
const CACHE_TTL_MS = 30 * 60_000;
const CACHE_PREFIX = "thermoguard.osm.v1:";

export interface Tile { r: number; c: number }
export const tileKeyOf = (lat: number, lon: number) => `${Math.floor(lat / TILE_DEG)}:${Math.floor(lon / TILE_DEG)}`;

export interface TilePlan {
  queried: Tile[];
  /** Number of tiles that held events but exceeded MAX_TILES and were not queried. */
  skipped: number;
  /** Tile keys that were queried; an event is "covered" when its tile is in this set. */
  covered: Set<string>;
}

/** Chooses the tiles to query. If more than MAX_TILES contain events, the busiest / most intense tiles win and the rest are reported as skipped. */
export function planTiles(events: { lat: number; lon: number; frpMw: number }[], max = MAX_TILES): TilePlan {
  const score = new Map<string, { t: Tile; s: number }>();
  for (const e of events) {
    const r = Math.floor(e.lat / TILE_DEG), c = Math.floor(e.lon / TILE_DEG), k = `${r}:${c}`;
    const cur = score.get(k) ?? { t: { r, c }, s: 0 };
    cur.s += 1 + Math.min(e.frpMw, 200) / 50;
    score.set(k, cur);
  }
  const ranked = [...score.entries()].sort((a, b) => b[1].s - a[1].s || (a[0] < b[0] ? -1 : 1));
  const keep = ranked.slice(0, max);
  return { queried: keep.map(([, v]) => v.t), skipped: Math.max(0, ranked.length - max), covered: new Set(keep.map(([k]) => k)) };
}

const f4 = (n: number) => n.toFixed(4);

/** Merges horizontally adjacent tiles of a row into one box, which keeps the union short. Overpass bbox order is (south,west,north,east). */
export function buildOverpassQuery(tiles: Tile[], timeoutS = 50): string {
  const rows = new Map<number, number[]>();
  for (const t of tiles) rows.set(t.r, [...(rows.get(t.r) ?? []), t.c]);
  const boxes: string[] = [];
  for (const [r, cols] of [...rows.entries()].sort((a, b) => a[0] - b[0])) {
    const sorted = [...new Set(cols)].sort((a, b) => a - b);
    let start = sorted[0], prev = start;
    const flush = (c0: number, c1: number) => boxes.push(`${f4(r * TILE_DEG - PAD_DEG)},${f4(c0 * TILE_DEG - PAD_DEG)},${f4((r + 1) * TILE_DEG + PAD_DEG)},${f4((c1 + 1) * TILE_DEG + PAD_DEG)}`);
    for (const c of sorted.slice(1)) { if (c !== prev + 1) { flush(start, prev); start = c; } prev = c; }
    flush(start, prev);
  }
  const filters = ['["landuse"="industrial"]', '["industrial"]', '["man_made"="works"]', '["power"="plant"]', '["landuse"="quarry"]'];
  const body = boxes.flatMap((b) => filters.map((f) => `  nwr${f}(${b});`)).join("\n");
  return `[out:json][timeout:${timeoutS}];\n(\n${body}\n);\nout center tags;`;
}

/* ------------------------------------------------------------------ classification */

const NON_THERMAL_SOURCE = /\b(solar|wind|hydro|water|tidal|wave|photovoltaic)\b/;
const THERMAL_SOURCE = /\b(coal|gas|oil|diesel|lignite|biomass|biofuel|waste|nuclear)\b/;
const EXCLUDED_INDUSTRIAL = /^(warehouse|logistics|distribution)$/;

export interface OsmClass { type: FacilityType; basis: string }

/**
 * Maps OSM tags to a ThermoGuard facility category. This is a transparent tag heuristic; `basis` records exactly which
 * tag or name fragment produced the category so the UI never overstates what OSM says.
 */
export function classifyOsm(tags: Record<string, string>): OsmClass | null {
  const lc = (v: string | undefined) => (v ?? "").toLowerCase();
  const industrial = lc(tags.industrial), landuse = lc(tags.landuse), manMade = lc(tags.man_made), power = lc(tags.power);
  const product = lc(tags.product ?? tags.produce), name = lc(`${tags.name ?? ""} ${tags["name:en"] ?? ""}`);
  if (EXCLUDED_INDUSTRIAL.test(industrial)) return null;
  /** Which tag or name fragment matched `re`, so the category can say what it is based on. */
  const from = (re: RegExp): string | null =>
    re.test(industrial) ? `industrial=${tags.industrial}`
      : re.test(product) ? `product=${tags.product ?? tags.produce}`
        : re.test(name) ? `name contains "${(name.match(re) ?? [""])[0]}"` : null;

  if (power === "plant") {
    const src = lc(tags["plant:source"] ?? tags["generator:source"]);
    if (NON_THERMAL_SOURCE.test(src)) return null; // solar / wind / hydro plants are not heat sources
    if (THERMAL_SOURCE.test(src)) return { type: "Thermal Power Plant", basis: `power=plant, plant:source=${tags["plant:source"] ?? tags["generator:source"]}` };
  }
  if (landuse === "quarry" || /^(quarry|mine|mining)$/.test(industrial) || manMade === "mine")
    return { type: "Mining Area", basis: landuse === "quarry" ? "landuse=quarry" : manMade === "mine" ? "man_made=mine" : `industrial=${tags.industrial}` };

  let b: string | null;
  if ((b = from(/refiner/))) return { type: "Oil Refinery", basis: b };
  if ((b = from(/\blng\b|liquefied natural gas|regasification/))) return { type: "LNG Terminal", basis: b };
  if ((b = from(/petrochem|petro-chem|cracker/))) return { type: "Petrochemical Plant", basis: b };
  if ((b = from(/chemical/))) return { type: "Chemical Plant", basis: b };
  if (/^(oil|gas|oil_and_gas|petroleum|fuel)$/.test(industrial)) return { type: "Gas / Oil Facility", basis: `industrial=${tags.industrial}` };
  if ((b = from(/steel|smelt|metallurg|foundry|ironworks|iron works/))) return { type: "Steel Plant", basis: b };
  if (power === "plant") return { type: "Industrial Works", basis: "power=plant (generation source not tagged)" };
  if (manMade === "works") return { type: "Industrial Works", basis: "man_made=works" };
  if (landuse === "industrial") return { type: "Industrial Area", basis: "landuse=industrial" };
  if (industrial) return { type: "Industrial Works", basis: `industrial=${tags.industrial}` };
  return null;
}

/* ------------------------------------------------------------------ normalization */

export interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number; lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}
export const UNNAMED_FACILITY = "Unnamed industrial facility";

export function normaliseOsmElements(elements: OsmElement[]): Facility[] {
  const out = new Map<string, Facility>();
  for (const el of elements) {
    if (!el || !el.tags || (el.type !== "node" && el.type !== "way" && el.type !== "relation")) continue;
    const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
    if (typeof lat !== "number" || typeof lon !== "number" || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const cls = classifyOsm(el.tags);
    if (!cls) continue;
    const id = `OSM-${el.type[0]}${el.id}`;
    const name = (el.tags.name ?? el.tags["name:en"] ?? "").trim();
    const region = el.tags["addr:city"] ?? el.tags["addr:district"] ?? el.tags["addr:state"] ?? "Region not tagged in OSM";
    out.set(id, {
      id, name: name || UNNAMED_FACILITY, type: cls.type, lat, lon, region, source: "osm", osmRef: `${el.type}/${el.id}`, unnamed: !name, osmBasis: cls.basis,
    });
  }
  return [...out.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
}

/* ------------------------------------------------------------------ cache */

interface CacheEntry { t: number; facilities: Facility[]; elements: number }
const memory = new Map<string, CacheEntry>();

function readCache(key: string, now: number): CacheEntry | null {
  const hit = memory.get(key);
  if (hit && now - hit.t < CACHE_TTL_MS) return hit;
  try {
    const raw = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(CACHE_PREFIX + key) : null;
    if (!raw) return null;
    const e = JSON.parse(raw) as CacheEntry;
    if (typeof e.t === "number" && now - e.t < CACHE_TTL_MS && Array.isArray(e.facilities)) { memory.set(key, e); return e; }
  } catch { /* unreadable cache entry: ignore */ }
  return null;
}
function writeCache(key: string, e: CacheEntry) {
  memory.set(key, e);
  try {
    if (typeof sessionStorage === "undefined") return;
    const s = JSON.stringify(e);
    if (s.length < 2_500_000) sessionStorage.setItem(CACHE_PREFIX + key, s); // quota is small: never risk the page over a cache
  } catch { /* storage full or blocked: the in-memory copy still serves this page */ }
}
export function clearOsmCache() {
  memory.clear();
  try { if (typeof sessionStorage !== "undefined") Object.keys(sessionStorage).filter((k) => k.startsWith(CACHE_PREFIX)).forEach((k) => sessionStorage.removeItem(k)); } catch { /* ignore */ }
}

/* ------------------------------------------------------------------ fetch */

export interface OsmResult {
  facilities: Facility[];
  elements: number;
  tilesQueried: number;
  tilesSkipped: number;
  /** Tile keys that were queried; events outside them have no OSM context. */
  covered: Set<string>;
  fromCache: boolean;
  endpoint: string;
}
export interface OsmFetchOptions { signal?: AbortSignal; fetchImpl?: typeof fetch; timeoutMs?: number; now?: number }

export async function fetchOsmFacilities(events: { lat: number; lon: number; frpMw: number }[], endpoint: string, opts: OsmFetchOptions = {}): Promise<OsmResult> {
  const plan = planTiles(events);
  const base = { tilesQueried: plan.queried.length, tilesSkipped: plan.skipped, covered: plan.covered, endpoint };
  if (!plan.queried.length) return { ...base, facilities: [], elements: 0, fromCache: false };

  const query = buildOverpassQuery(plan.queried);
  const cacheKey = `${endpoint}|${[...plan.covered].sort().join(",")}`;
  const now = opts.now ?? Date.now();
  const cached = readCache(cacheKey, now);
  if (cached) return { ...base, facilities: cached.facilities, elements: cached.elements, fromCache: true };

  const doFetch = opts.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, opts.timeoutMs ?? 60_000);
  const onAbort = () => ctrl.abort();
  opts.signal?.addEventListener("abort", onAbort);
  try {
    // application/x-www-form-urlencoded is a CORS "simple" request: no preflight.
    const res = await doFetch(endpoint, { method: "POST", body: new URLSearchParams({ data: query }), signal: ctrl.signal });
    if (res.status === 429) throw new LiveSourceError("rate_limited", "OpenStreetMap (Overpass) is rate limiting requests.", "HTTP 429");
    if (!res.ok) throw new LiveSourceError("http", "OpenStreetMap context could not be loaded right now.", `HTTP ${res.status}`);
    let json: { elements?: unknown; remark?: unknown };
    try { json = await res.json(); } catch { throw new LiveSourceError("bad_response", "OpenStreetMap returned an unreadable response.", "invalid JSON"); }
    // Overpass reports a timeout / out-of-memory as HTTP 200 with a "remark" and possibly PARTIAL elements: do not trust them.
    if (typeof json.remark === "string" && /runtime error|timed out|out of memory/i.test(json.remark))
      throw new LiveSourceError("partial", "OpenStreetMap context timed out and is incomplete.", json.remark);
    if (!Array.isArray(json.elements)) throw new LiveSourceError("bad_response", "OpenStreetMap returned an unexpected response.", "missing elements");
    const facilities = normaliseOsmElements(json.elements as OsmElement[]);
    writeCache(cacheKey, { t: now, facilities, elements: json.elements.length });
    return { ...base, facilities, elements: json.elements.length, fromCache: false };
  } catch (e) {
    if (e instanceof LiveSourceError) { console.warn("[ThermoGuard] Overpass request failed:", endpoint, e.detail ?? e.message); throw e; }
    if (isAbort(e)) {
      if (timedOut) throw new LiveSourceError("timeout", "OpenStreetMap context did not respond in time.", "timeout");
      throw e;
    }
    console.warn("[ThermoGuard] Overpass request could not be completed (offline, blocked, or rate-limited without CORS headers):", endpoint, e);
    throw new LiveSourceError("network", "OpenStreetMap context could not be loaded. The request was blocked or the network is unavailable.", String(e));
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
  }
}
