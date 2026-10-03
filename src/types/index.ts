export type RiskLevel = "critical" | "high" | "moderate" | "low";
export type Classification =
  | "industrial_fire" | "gas_flare" | "persistent_heat" | "agri_burning" | "wildfire" | "mining" | "unknown";
export type EventStatus = "investigating" | "active" | "monitoring" | "resolved";
export type FacilityType =
  | "Oil Refinery" | "Petrochemical Plant" | "Thermal Power Plant" | "Steel Plant" | "Mining Area" | "LNG Terminal"
  // Phase 3C: categories that OpenStreetMap tagging can support but the demonstration dataset does not use.
  | "Chemical Plant" | "Gas / Oil Facility" | "Industrial Works" | "Industrial Area";

/** Where a thermal event came from. Demo events are simulated; "firms" events are NASA FIRMS thermal anomaly observations. */
export type EventSource = "demo" | "firms";
/** Where a facility came from. Demo facilities are fictional; "osm" facilities are OpenStreetMap objects. */
export type FacilitySource = "demo" | "osm";

export interface ThermalEvent {
  id: string;
  lat: number;
  lon: number;
  detectedAt: string; // ISO-8601 UTC
  satellite: string;
  instrument: string;
  frpMw: number;
  brightnessK: number;
  /** Sensor detection confidence in percent. null when the sensor reports a category instead (VIIRS: low / nominal / high). */
  confidence: number | null;
  /** Categorical sensor confidence as reported by FIRMS (VIIRS). Absent for demo events and for MODIS, which reports a percentage. */
  confidenceLabel?: "low" | "nominal" | "high";
  /** Defaults to "demo" when absent. */
  source?: EventSource;
  /** Live mode: true when OpenStreetMap was queried around this event, false when its area was outside the query limit. Undefined when OSM was not loaded. */
  osmCovered?: boolean;
  classification: Classification;
  risk: RiskLevel;
  status: EventStatus;
  persistenceActive: number;
  persistenceTotal: number;
  region: string;
}

export interface Facility {
  id: string;
  name: string;
  type: FacilityType;
  lat: number;
  lon: number;
  region: string;
  /** Defaults to "demo" when absent. */
  source?: FacilitySource;
  /** OpenStreetMap element reference such as "way/12345". Only set for OSM facilities. */
  osmRef?: string;
  /** True when the OSM object carries no name tag and the display name is a neutral placeholder. */
  unnamed?: boolean;
  /** Raw OSM tags that produced the category, kept so the UI can show exactly what the type is based on. */
  osmBasis?: string;
}

export type DataMode = "demo" | "live";

/** One day in a location's observation history. `active` = a thermal detection occurred; otherwise no detection (or no usable overpass). */
export interface Observation {
  day: number; // 1 = oldest ... N = day of the event
  date: string; // ISO-8601 UTC
  active: boolean;
  frpMw: number | null;
}

export type LandUseKind = "industrial" | "mining" | "agricultural" | "forest" | "undetermined";
export interface LandContext { kind: LandUseKind; label: string; detail: string }

export type FactorKey = "thermal" | "persistence" | "proximity" | "abnormality";
export interface FactorScore {
  key: FactorKey; label: string;
  value: number; // 0..1
  weight: number; // 0..1, weights sum to 1
  points: number; // value * weight * 100
  detail: string;
  baselineAvailable?: boolean;
}
export interface EvidenceItem { key: string; text: string; detail: string }
export interface ClassFit { cls: Classification; fit: number }
export interface FitComponent { label: string; score: number; weight: number }

export interface PersistenceStats {
  /** False when there is not enough observation history to judge persistence (live mode, observation window too short). */
  available: boolean;
  total: number; active: number; percent: number;
  longestStreak: number; currentStreak: number;
  baselineFrpMw: number | null; // mean FRP of prior active observations
  frpRatio: number | null; // current FRP / baseline
}

export interface EventAssessment {
  eventId: string;
  classification: Classification;
  confidence: number; // rule-agreement score, NOT a trained-model probability
  fits: ClassFit[]; // all candidate classes, best first
  topFit: number;
  basis: FitComponent[]; // component breakdown for the winning class (empty for unknown)
  riskScore: number; // 0..100
  riskLevel: RiskLevel;
  factors: FactorScore[];
  evidence: EvidenceItem[];
  nearest: { facility: Facility; km: number } | null;
  neighbours: { facility: Facility; km: number }[];
  land: LandContext;
  persistence: PersistenceStats;
}

export type ThermalSource = "Demo" | "NASA FIRMS";
export type FacilitySourceLabel = "Demo" | "OpenStreetMap" | "Unavailable";
export type HistorySource = "Demo" | "FIRMS" | "Unavailable";

/** Data provenance, so every screen can say honestly where its numbers came from. */
export interface DatasetSources {
  thermal: ThermalSource;
  facilities: FacilitySourceLabel;
  history: HistorySource;
}

/** Phase 3C: how the dataset was obtained, including why a live attempt fell back to demo data. */
export interface LiveStatus {
  /** What the user asked for (env or ?mode=). */
  requested: DataMode;
  /** true when the live thermal request succeeded. */
  thermalOk: boolean;
  /** true / false when the OSM request ran, null when it was not attempted (no events). */
  facilitiesOk: boolean | null;
  /** Professional, user-facing explanations (never raw stack traces). */
  messages: string[];
  /** FIRMS-specific facts shown in the UI and reports. */
  firms?: {
    source: string; bbox: string; regionLabel: string; dayRange: number;
    records: number; duplicatesRemoved: number; skipped: number; locations: number;
    newestObservation: string | null;
  };
  osm?: { elements: number; tilesQueried: number; tilesSkipped: number; endpoint: string };
  /** ISO time of the last successful live fetch (the data's fetch time, not the page load time). */
  fetchedAt: string | null;
}

export interface ThermalDataset {
  mode: DataMode;
  sourceLabel: string;
  referenceTime: string; // the "now" of the snapshot
  events: ThermalEvent[];
  facilities: Facility[];
  /** Per-event observation history keyed by event id (simulated in demo mode, derived from the FIRMS window in live mode). */
  history: Record<string, Observation[]>;
  /** Phase 3C provenance. Optional so older callers keep compiling; the data services always set it. */
  sources?: DatasetSources;
  live?: LiveStatus;
  /** Days covered by the history window (live: the FIRMS day range; demo: 10). */
  historyWindowDays?: number;
}
