import type { Classification, Facility, FacilityType, RiskLevel, ThermalEvent } from "@/types";
import { destinationPoint } from "@/services/geospatial/geo";
import { demoFacilities } from "./facilities";
import { FARMLAND, FOREST, type Anchor } from "./landuse";

/** Fixed "now" for the demo snapshot: 01 Oct 2026, 21:48 IST. */
export const DEMO_REFERENCE_TIME = "2026-10-01T16:18:00Z";

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Archetype {
  cls: Classification; n: number; near: FacilityType[] | Anchor[];
  dist: [number, number]; frp: [number, number]; bt: [number, number]; pers: [number, number];
}

const OIL_GAS: FacilityType[] = ["Oil Refinery", "Petrochemical Plant", "LNG Terminal"];
const ARCHETYPES: Archetype[] = [
  { cls: "industrial_fire", n: 5, near: OIL_GAS, dist: [0.2, 1.5], frp: [55, 115], bt: [335, 365], pers: [3, 9] },
  { cls: "persistent_heat", n: 10, near: ["Thermal Power Plant", "Steel Plant", "Oil Refinery", "Petrochemical Plant"], dist: [0.1, 0.8], frp: [8, 34], bt: [310, 330], pers: [9, 10] },
  { cls: "gas_flare", n: 7, near: OIL_GAS, dist: [0.1, 1.0], frp: [20, 60], bt: [320, 345], pers: [6, 10] },
  { cls: "mining", n: 5, near: ["Mining Area"], dist: [0.5, 3], frp: [6, 25], bt: [305, 325], pers: [4, 8] },
  { cls: "agri_burning", n: 8, near: FARMLAND, dist: [3, 22], frp: [5, 30], bt: [305, 330], pers: [1, 2] },
  { cls: "wildfire", n: 2, near: FOREST, dist: [1, 12], frp: [30, 70], bt: [330, 355], pers: [1, 3] },
  { cls: "unknown", n: 3, near: ["Steel Plant", "Thermal Power Plant", "Oil Refinery", "Mining Area"], dist: [3, 15], frp: [10, 40], bt: [308, 335], pers: [1, 4] },
];

function riskFor(cls: Classification, frp: number): RiskLevel {
  switch (cls) {
    case "industrial_fire": return frp >= 90 ? "critical" : "high";
    case "gas_flare": return frp >= 45 ? "high" : "moderate";
    case "persistent_heat": return frp < 20 ? "low" : "moderate";
    case "wildfire": return frp >= 50 ? "high" : "moderate";
    case "mining": return frp >= 18 ? "moderate" : "low";
    case "agri_burning": return frp >= 20 ? "moderate" : "low";
    default: return "moderate";
  }
}

const SENSORS: [string, string][] = [
  ["VIIRS", "Suomi NPP"], ["VIIRS", "NOAA-20"], ["VIIRS", "NOAA-21"], ["MODIS", "Aqua"], ["MODIS", "Terra"],
];

export function generateDemoEvents(facilities: Facility[] = demoFacilities): ThermalEvent[] {
  const rnd = mulberry32(2026);
  const between = (a: number, b: number) => a + rnd() * (b - a);
  const draft: Omit<ThermalEvent, "id">[] = [];

  for (const a of ARCHETYPES) {
    for (let i = 0; i < a.n; i++) {
      let lat: number, lon: number, region: string;
      const isAnchorList = typeof a.near[0] === "object";
      const bearing = rnd() * 360;
      const dist = between(...a.dist);
      if (isAnchorList) {
        const anc = (a.near as Anchor[])[Math.floor(rnd() * a.near.length)];
        [lat, lon] = destinationPoint(anc.lat, anc.lon, bearing, dist);
        region = anc.region;
      } else {
        const pool = facilities.filter((f) => (a.near as FacilityType[]).includes(f.type));
        const f = pool[Math.floor(rnd() * pool.length)];
        [lat, lon] = destinationPoint(f.lat, f.lon, bearing, dist);
        region = f.region;
      }
      let frp = Math.round(between(...a.frp) * 10) / 10;
      let bt = Math.round(between(...a.bt));
      let active = Math.round(between(...a.pers));
      let conf = Math.round(between(60, 97));
      let minsAgo = Math.floor(between(12, 72 * 60));
      const [instrument, satellite] = SENSORS[Math.floor(rnd() * SENSORS.length)];
      if (a.cls === "industrial_fire" && i === 0) {
        // Anchor event used by the guided demo scenario: 0.43 km from Navi Mumbai Refinery Unit.
        const f = facilities.find((x) => x.id === "FAC-05")!;
        [lat, lon] = destinationPoint(f.lat, f.lon, 40, 0.43);
        region = f.region; frp = 82; bt = 341; active = 8; conf = 91; minsAgo = 6;
      }
      if (a.cls === "industrial_fire" && i === 1) { frp = 104; bt = 358; }
      const risk = riskFor(a.cls, frp);
      const status = risk === "critical" || risk === "high" ? (draft.length % 2 ? "active" : "investigating")
        : risk === "moderate" ? (draft.length % 3 ? "active" : "monitoring")
        : a.cls === "persistent_heat" ? "monitoring" : "resolved";
      draft.push({
        lat: +lat.toFixed(5), lon: +lon.toFixed(5),
        detectedAt: new Date(Date.parse("2026-10-01T16:18:00Z") - minsAgo * 60000).toISOString(),
        satellite, instrument, frpMw: frp, brightnessK: bt, confidence: conf, classification: a.cls, risk, status,
        persistenceActive: active, persistenceTotal: 10, region,
      });
    }
  }
  // Sequential IDs by detection time: the newest event is TG-2026-00421.
  draft.sort((x, y) => Date.parse(x.detectedAt) - Date.parse(y.detectedAt));
  const events = draft.map((d, i) => ({ id: `TG-2026-${String(382 + i).padStart(5, "0")}`, ...d }));
  return events.reverse();
}

export const demoEvents = generateDemoEvents();
