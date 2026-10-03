import type { Classification, EventAssessment, RiskLevel, ThermalDataset } from "@/types";
import type { AlertSummary, FacilityStats, Insight } from "@/types/intelligence";
import { CLASS_LABEL } from "@/utils/format";
import { PROXIMITY_RANGE_KM } from "@/services/analysis/engine";
import { ZONE_KM } from "./facilities";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

/* ---------- Risk distribution ---------- */
export const RISK_ORDER: RiskLevel[] = ["critical", "high", "moderate", "low"];
export interface RiskBucket { level: RiskLevel; count: number; share: number }
export function riskDistribution(ds: ThermalDataset): RiskBucket[] {
  return RISK_ORDER.map((level) => {
    const count = ds.events.filter((e) => e.risk === level).length;
    return { level, count, share: pct(count, ds.events.length) };
  });
}

/* ---------- Classification distribution ----------
 * The engine produces seven classes. The analytics view reports the four operational categories below, each defined
 * by the engine classes it contains, and keeps the underlying counts visible so nothing is hidden by the grouping.
 */
export interface ClassGroupDef { key: string; label: string; classes: Classification[]; industrial: boolean; hint: string }
export const CLASS_GROUPS: ClassGroupDef[] = [
  { key: "industrial_fire", label: "Industrial Fire", classes: ["industrial_fire"], industrial: true, hint: "Spike at or near an industrial facility" },
  { key: "persistent", label: "Persistent Thermal Source", classes: ["persistent_heat"], industrial: true, hint: "Steady, near-continuous industrial heat" },
  { key: "controlled", label: "Possible Controlled Heat Source", classes: ["gas_flare", "mining"], industrial: true, hint: "Gas flares and mining activity" },
  { key: "non_industrial", label: "Non-Industrial / Low-Risk Anomaly", classes: ["agri_burning", "wildfire", "unknown"], industrial: false, hint: "Agricultural burning, wildfire and unclassified anomalies" },
];
export interface ClassGroupBucket { def: ClassGroupDef; count: number; share: number; parts: { cls: Classification; count: number }[] }
export function classificationGroups(ds: ThermalDataset): ClassGroupBucket[] {
  return CLASS_GROUPS.map((def) => {
    const parts = def.classes.map((cls) => ({ cls, count: ds.events.filter((e) => e.classification === cls).length }));
    const count = parts.reduce((a, p) => a + p.count, 0);
    return { def, count, share: pct(count, ds.events.length), parts };
  });
}

/* ---------- Industrial correlation ---------- */
export interface CorrelationResult { near: number; moderate: number; far: number; total: number }
/** near: within the 1 km facility zone; moderate: 1 km to the 5 km proximity range; far: beyond 5 km (or no facility in the dataset). */
export function industrialCorrelation(ds: ThermalDataset, assessments: Record<string, EventAssessment>): CorrelationResult {
  const r: CorrelationResult = { near: 0, moderate: 0, far: 0, total: ds.events.length };
  for (const e of ds.events) {
    const km = assessments[e.id]?.nearest?.km ?? Infinity;
    if (km <= ZONE_KM) r.near++; else if (km <= PROXIMITY_RANGE_KM) r.moderate++; else r.far++;
  }
  return r;
}

/* ---------- Persistent hotspots ---------- */
export const HOTSPOT_MIN_EVENTS = 2;
/** Facilities with repeated thermal events (2 or more related events), most events first, then highest score. */
export function persistentHotspots(stats: FacilityStats[]): FacilityStats[] {
  return stats.filter((s) => s.total >= HOTSPOT_MIN_EVENTS)
    .sort((a, b) => b.total - a.total || (b.highest?.score ?? 0) - (a.highest?.score ?? 0));
}

/* ---------- AI-Assisted Insights ----------
 * Plain rule-based statements computed from the loaded data. Not produced by a trained model.
 */
export function buildInsights(ds: ThermalDataset, assessments: Record<string, EventAssessment>, hotspots: FacilityStats[], alerts: AlertSummary): Insight[] {
  const out: Insight[] = [];
  const total = ds.events.length;
  if (!total) return out;

  const top = [...ds.events].sort((a, b) => (assessments[b.id]?.riskScore ?? 0) - (assessments[a.id]?.riskScore ?? 0))[0];
  const ta = assessments[top.id];
  out.push({
    key: "top", tone: ta.riskLevel === "critical" ? "red" : ta.riskLevel === "high" ? "orange" : "amber", to: `/investigation?event=${top.id}`,
    text: `The highest-risk event is ${top.id} with a score of ${ta.riskScore} (${CLASS_LABEL[ta.classification]})${ta.nearest ? `, ${ta.nearest.km.toFixed(2)} km from ${ta.nearest.facility.name}` : ""}.`,
  });

  const urgent = ds.events.filter((e) => e.risk === "critical" || e.risk === "high");
  const urgentNear = urgent.filter((e) => (assessments[e.id]?.nearest?.km ?? Infinity) <= ZONE_KM);
  out.push(urgent.length
    ? { key: "urgent-near", tone: urgentNear.length ? "orange" : "green", to: "/alerts?sort=risk",
        text: `${urgentNear.length} of ${plural(urgent.length, "high/critical event")} ${urgentNear.length === 1 ? "was" : "were"} detected within ${ZONE_KM} km of an industrial facility.` }
    : { key: "urgent-near", tone: "green", text: "No high or critical events are present in the loaded dataset." });

  out.push({
    key: "hotspots", tone: hotspots.length ? "amber" : "green", to: "/sites?sort=events",
    text: hotspots.length
      ? `${plural(hotspots.length, "facility location")} ${hotspots.length === 1 ? "shows" : "show"} repeated thermal activity (${HOTSPOT_MIN_EVENTS} or more related events within ${PROXIMITY_RANGE_KM} km).`
      : `No facility location shows repeated thermal activity (${HOTSPOT_MIN_EVENTS} or more related events).`,
  });

  const industrialClasses = new Set(CLASS_GROUPS.filter((g) => g.industrial).flatMap((g) => g.classes));
  const industrial = ds.events.filter((e) => industrialClasses.has(e.classification)).length;
  out.push({
    key: "industrial", tone: "blue",
    text: `${pct(industrial, total)}% of detected events (${industrial} of ${total}) are classified as industrial-related: industrial fire, persistent thermal source or possible controlled heat source.`,
  });

  out.push({
    key: "open", tone: alerts.critical + alerts.high ? "orange" : "green", to: "/alerts",
    text: `${plural(alerts.active, "alert")} ${alerts.active === 1 ? "is" : "are"} still open, including ${alerts.critical} critical and ${alerts.high} high-priority.`,
  });
  return out;
}
