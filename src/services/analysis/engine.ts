import type {
  ClassFit, Classification, EventAssessment, EvidenceItem, Facility, FactorScore, FitComponent, Observation,
  PersistenceStats, RiskLevel, ThermalDataset, ThermalEvent,
} from "@/types";
import { nearestFacilities } from "@/services/geospatial/geo";
import { landContextAt } from "./landContext";

/**
 * AI-Assisted Geospatial Classification: a transparent, rule-based prototype.
 * There is NO trained machine-learning or deep-learning model here. Every score is a weighted combination of
 * fuzzy rules over event measurements, observation history and facility/land-use context, so each output can be traced.
 */

export const RISK_WEIGHTS = { thermal: 0.35, persistence: 0.2, proximity: 0.25, abnormality: 0.2 } as const;
export const UNKNOWN_THRESHOLD = 0.6;
export const PROXIMITY_RANGE_KM = 5;
export const EVIDENCE_THRESHOLD = 0.5;
/** Live mode: fewer observation days than this in the FIRMS window is not enough to judge persistence (reported as unavailable). */
export const MIN_HISTORY_DAYS = 3;
/**
 * VIIRS reports sensor confidence as low / nominal / high, not a percentage. For the rule-agreement score only, these map to
 * fixed ordinal weights. The UI never shows them as a measured percentage; it shows the category FIRMS reported.
 */
export const SENSOR_CONFIDENCE_ORDINAL = { low: 0.3, nominal: 0.6, high: 0.9 } as const;
/** Sensor confidence as 0..1 for the rule score. Percent (MODIS, demo) is used as is; a VIIRS category uses the ordinal weight; absent = neutral 0.5. */
export const sensorConfidence01 = (e: ThermalEvent): number =>
  e.confidence != null ? e.confidence / 100 : e.confidenceLabel ? SENSOR_CONFIDENCE_ORDINAL[e.confidenceLabel] : 0.5;

const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
/** 0 at a, 1 at b, linear between. Works for descending ranges (a > b). */
const ramp = (x: number, a: number, b: number) => clamp((x - a) / (b - a));
/** Trapezoid membership: 0 below a, rises to 1 at b, holds to c, falls to 0 at d. */
const trap = (x: number, a: number, b: number, c: number, d: number) => (x < b ? ramp(x, a, b) : x <= c ? 1 : ramp(x, d, c));

export function riskLevelFor(score: number): RiskLevel {
  return score <= 30 ? "low" : score <= 60 ? "moderate" : score <= 80 ? "high" : "critical";
}

export function persistenceStats(event: ThermalEvent, obs: Observation[]): PersistenceStats {
  const total = obs.length || event.persistenceTotal;
  const active = obs.length ? obs.filter((o) => o.active).length : event.persistenceActive;
  let longest = 0, run = 0;
  for (const o of obs) { run = o.active ? run + 1 : 0; longest = Math.max(longest, run); }
  const prior = obs.slice(0, -1).filter((o) => o.active && o.frpMw != null).map((o) => o.frpMw as number);
  const baseline = prior.length >= 2 ? prior.reduce((a, b) => a + b, 0) / prior.length : null;
  // Demo history is always complete. A live FIRMS window may be too short (event first seen late in the window).
  const available = event.source === "firms" ? obs.length >= MIN_HISTORY_DAYS : total > 0;
  return {
    available, total, active, percent: total ? Math.round((active / total) * 100) : 0, longestStreak: longest, currentStreak: run,
    baselineFrpMw: baseline, frpRatio: baseline ? event.frpMw / baseline : null,
  };
}

interface Feat {
  /** p is null when observation history is unavailable; persistence-based rule components then use a neutral 0.5. */
  frp: number; bt: number; p: number | null; d: number; ratio: number | null;
  oilGas: boolean; mining: boolean; landKind: string;
}
const wsum = (parts: FitComponent[]) => clamp(parts.reduce((a, c) => a + c.score * c.weight, 0));

function fitComponents(cls: Exclude<Classification, "unknown">, f: Feat): FitComponent[] {
  const steady = f.ratio == null ? 0.5 : 1 - ramp(f.ratio, 1.15, 1.7);
  const c = (label: string, score: number, weight: number): FitComponent => ({ label, score: clamp(score), weight });
  /** Persistence-based component: neutral 0.5 and a plain label when history is unavailable, never a fabricated value. */
  const pc = (label: string, fn: (p: number) => number, weight: number): FitComponent =>
    f.p == null ? c(`${label} (history unavailable, neutral)`, 0.5, weight) : c(label, fn(f.p), weight);
  switch (cls) {
    case "industrial_fire": return [
      c("High FRP", ramp(f.frp, 35, 85), 0.25), c("High brightness temperature", ramp(f.bt, 322, 350), 0.1),
      c("Close to industrial facility", ramp(f.d, 3, 0.8) * (f.oilGas ? 1 : 0.8), 0.2),
      c("Spike above historical baseline", f.ratio == null ? 0.3 : ramp(f.ratio, 1.2, 2.0), 0.25),
      pc("Not a steady source", (p) => 1 - ramp(p, 0.8, 1.0), 0.2),
    ];
    case "gas_flare": return [
      c("Oil / gas facility on site", ramp(f.d, 2.0, 0.6) * (f.oilGas ? 1 : 0), 0.3), pc("Repeated observations", (p) => ramp(p, 0.4, 0.8), 0.25),
      c("Moderate FRP", trap(f.frp, 10, 18, 60, 90), 0.15), c("Stable against baseline", steady, 0.15),
      c("Flare-range brightness temperature", trap(f.bt, 312, 320, 348, 365), 0.15),
    ];
    case "persistent_heat": return [
      pc("Near-continuous observations", (p) => ramp(p, 0.75, 0.95), 0.3), c("Close to industrial facility", ramp(f.d, 2.0, 0.8) * (f.oilGas ? 0.8 : 1), 0.2),
      c("Low-to-moderate FRP", ramp(f.frp, 50, 30), 0.2), c("Stable against baseline", steady, 0.2), c("Low brightness temperature", ramp(f.bt, 335, 320), 0.1),
    ];
    case "mining": return [
      c("Mining area nearby", ramp(f.d, 4, 1.2) * (f.mining ? 1 : 0), 0.35), pc("Intermittent observations", (p) => trap(p, 0.2, 0.4, 0.85, 1.0), 0.2),
      c("Low FRP", ramp(f.frp, 35, 22), 0.15), c("Low brightness temperature", ramp(f.bt, 335, 325), 0.1), c("Stable against baseline", steady, 0.2),
    ];
    case "agri_burning": return [
      c("Agricultural land-use", f.landKind === "agricultural" ? 1 : 0, 0.25), c("Remote from facilities", ramp(f.d, 2, 5), 0.25),
      pc("Short-lived (low persistence)", (p) => ramp(p, 0.5, 0.2), 0.25), c("Low FRP", ramp(f.frp, 45, 25), 0.15), c("Low brightness temperature", ramp(f.bt, 345, 330), 0.1),
    ];
    case "wildfire": return [
      c("Forest / vegetated land-use", f.landKind === "forest" ? 1 : 0, 0.3), c("Remote from facilities", ramp(f.d, 2, 5), 0.2),
      pc("Short-lived (low persistence)", (p) => ramp(p, 0.6, 0.3), 0.2), c("High FRP", ramp(f.frp, 20, 45), 0.15), c("High brightness temperature", ramp(f.bt, 320, 340), 0.15),
    ];
  }
}

const CANDIDATES: Exclude<Classification, "unknown">[] = ["industrial_fire", "gas_flare", "persistent_heat", "mining", "agri_burning", "wildfire"];
/** Land-use gate: vegetation-fire classes lose a share of their fit when the land-use zone does not match. */
const gate = (cls: Classification, land: string) =>
  cls === "agri_burning" ? (land === "agricultural" ? 1 : 0.6) : cls === "wildfire" ? (land === "forest" ? 1 : 0.6) : 1;

const OIL_GAS_TYPES: Facility["type"][] = ["Oil Refinery", "Petrochemical Plant", "LNG Terminal", "Gas / Oil Facility"];
const frpWord = (v: number) => (v >= 0.75 ? "Very high" : "High");

export function assessEvent(event: ThermalEvent, facilities: Facility[], obs: Observation[]): EventAssessment {
  // One pass over the facilities gives both the nearest and the three nearest (same haversine as before).
  const neighbours = nearestFacilities(event.lat, event.lon, facilities, 3);
  const nearest = neighbours[0] ?? null;
  const land = landContextAt(event.lat, event.lon, nearest, event.source === "firms" ? "live" : "demo");
  const pers = persistenceStats(event, obs);
  const p = pers.available && pers.total ? pers.active / pers.total : null;
  const d = nearest?.km ?? 99;
  const feat: Feat = {
    frp: event.frpMw, bt: event.brightnessK, p, d, ratio: pers.frpRatio,
    oilGas: !!nearest && OIL_GAS_TYPES.includes(nearest.facility.type),
    mining: nearest?.facility.type === "Mining Area", landKind: land.kind,
  };

  // ---- Classification
  const comps = new Map(CANDIDATES.map((c) => [c, fitComponents(c, feat)]));
  const fits: ClassFit[] = CANDIDATES.map((cls) => ({ cls, fit: +(wsum(comps.get(cls)!) * gate(cls, land.kind)).toFixed(3) })).sort((a, b) => b.fit - a.fit);
  const top = fits[0], second = fits[1];
  const isUnknown = top.fit < UNKNOWN_THRESHOLD;
  const classification: Classification = isUnknown ? "unknown" : top.cls;
  const sensor = sensorConfidence01(event);
  const confidence = Math.round(clamp(
    isUnknown
      ? 0.25 + 0.25 * (1 - top.fit) + 0.15 * sensor
      : 0.55 * top.fit + 0.25 * clamp((top.fit - second.fit) / 0.35) + 0.2 * sensor,
  ) * 100);

  // ---- Risk score
  const thermal = 0.65 * clamp(event.frpMw / 100) + 0.35 * ramp(event.brightnessK, 300, 370);
  const proximity = nearest ? clamp(1 - nearest.km / PROXIMITY_RANGE_KM) : 0;
  const baselineAvailable = pers.frpRatio != null;
  const abnormality = baselineAvailable ? clamp((pers.frpRatio! - 1) / 1.5) : 0.5;
  const mk = (key: FactorScore["key"], label: string, value: number, detail: string, extra: Partial<FactorScore> = {}): FactorScore => ({
    key, label, value, weight: RISK_WEIGHTS[key], points: value * RISK_WEIGHTS[key] * 100, detail, ...extra,
  });
  const factors: FactorScore[] = [
    mk("thermal", "Thermal Intensity", thermal, `FRP ${event.frpMw} MW (65%) and brightness temperature ${event.brightnessK} K (35%)`),
    mk("persistence", "Persistence", p ?? 0.5,
      p != null ? `${pers.active} of ${pers.total} days with a detection`
        : `Historical persistence unavailable for this live observation (fewer than ${MIN_HISTORY_DAYS} days in the FIRMS window); neutral value 50% used`),
    mk("proximity", "Industrial Proximity", proximity, nearest ? `${nearest.km.toFixed(2)} km to nearest facility; falls to 0 at ${PROXIMITY_RANGE_KM} km` : "No facility in dataset"),
    mk("abnormality", "Historical Anomaly", abnormality,
      baselineAvailable ? `Current FRP is ${pers.frpRatio!.toFixed(2)}x the ${pers.baselineFrpMw!.toFixed(1)} MW prior mean` : "Fewer than 2 prior detections, so neutral value 50% used",
      { baselineAvailable }),
  ];
  const riskScore = Math.round(factors.reduce((a, f) => a + f.points, 0));

  // ---- Evidence: only factors that actually contributed (value at or above threshold)
  const evidence: EvidenceItem[] = [];
  if (thermal >= EVIDENCE_THRESHOLD) evidence.push({ key: "thermal", text: `${frpWord(thermal)} thermal intensity`, detail: `FRP ${event.frpMw} MW, brightness temperature ${event.brightnessK} K` });
  if (nearest && proximity >= EVIDENCE_THRESHOLD) evidence.push({ key: "proximity", text: "Industrial facility detected nearby", detail: `${nearest.facility.name}, ${nearest.km.toFixed(2)} km away` });
  if (p != null && p >= EVIDENCE_THRESHOLD) evidence.push({ key: "persistence", text: "Repeated thermal observations", detail: `${pers.active} of ${pers.total} days active (${pers.percent}%)` });
  if (land.kind === "industrial" || land.kind === "mining") evidence.push({ key: "land", text: "Industrial land-use context", detail: land.detail });
  if (baselineAvailable && abnormality >= EVIDENCE_THRESHOLD) evidence.push({ key: "abnormality", text: "Activity above historical baseline", detail: `${pers.frpRatio!.toFixed(2)}x the mean FRP of earlier detections` });

  return {
    eventId: event.id, classification, confidence, fits, topFit: top.fit,
    basis: isUnknown ? [] : comps.get(top.cls as Exclude<Classification, "unknown">)!, riskScore, riskLevel: riskLevelFor(riskScore),
    factors, evidence, nearest, neighbours, land, persistence: pers,
  };
}

/** Runs the engine over a dataset and returns events carrying the engine's classification and risk level. */
export function analyseDataset(ds: ThermalDataset): { dataset: ThermalDataset; assessments: Record<string, EventAssessment> } {
  const assessments: Record<string, EventAssessment> = {};
  const events = ds.events.map((e) => {
    const a = assessEvent(e, ds.facilities, ds.history[e.id] ?? []);
    assessments[e.id] = a;
    return { ...e, classification: a.classification, risk: a.riskLevel };
  });
  return { dataset: { ...ds, events }, assessments };
}
