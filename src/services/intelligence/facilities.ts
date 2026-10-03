import type { EventAssessment, RiskLevel, ThermalDataset } from "@/types";
import type { FacilityEvent, FacilityPersistenceKey, FacilityRiskStatus, FacilityStats } from "@/types/intelligence";
import { PROXIMITY_RANGE_KM } from "@/services/analysis/engine";
import { RISK_RANK } from "@/utils/format";
import { persistenceStatus } from "./persistence";

/** An event is "related" to its nearest facility when it lies within the engine's proximity range (5 km). */
export const RELATED_RADIUS_KM = PROXIMITY_RANGE_KM;
/** The 1 km facility zone drawn on the maps and used in the investigation's zone-status wording. */
export const ZONE_KM = 1;

const PERSISTENCE_LABEL: Record<FacilityPersistenceKey, string> = {
  persistent: "Persistent activity", recurring: "Recurring activity", isolated: "Single event", none: "No activity", unavailable: "History unavailable",
};
const LEVELS: RiskLevel[] = ["critical", "high", "moderate", "low"];

/**
 * Pure: groups events by their nearest facility (within RELATED_RADIUS_KM) and derives facility-level figures from the
 * Phase 2 assessments. `openEventIds` are events whose alert is not resolved; they drive the facility's current risk status.
 */
export function buildFacilityStats(ds: ThermalDataset, assessments: Record<string, EventAssessment>, openEventIds: Set<string>): FacilityStats[] {
  const grouped = new Map<string, FacilityEvent[]>();
  for (const event of ds.events) {
    const assessment = assessments[event.id];
    if (!assessment?.nearest || assessment.nearest.km > RELATED_RADIUS_KM) continue;
    const row: FacilityEvent = { event, assessment, km: assessment.nearest.km, persistence: persistenceStatus(assessment.persistence), open: openEventIds.has(event.id) };
    const list = grouped.get(assessment.nearest.facility.id);
    if (list) list.push(row); else grouped.set(assessment.nearest.facility.id, [row]);
  }

  return ds.facilities.map((facility) => {
    const events = (grouped.get(facility.id) ?? []).sort((a, b) => Date.parse(b.event.detectedAt) - Date.parse(a.event.detectedAt));
    const byRisk = Object.fromEntries(LEVELS.map((l) => [l, events.filter((x) => x.assessment.riskLevel === l).length])) as Record<RiskLevel, number>;
    const top = events.reduce<FacilityEvent | null>((b, x) => (!b || x.assessment.riskScore > b.assessment.riskScore ? x : b), null);
    const openTop = events.filter((x) => x.open).reduce<RiskLevel | null>((b, x) => (!b || RISK_RANK[x.assessment.riskLevel] > RISK_RANK[b] ? x.assessment.riskLevel : b), null);
    const persistentCount = events.filter((x) => x.persistence.key === "persistent").length;
    const judged = events.filter((x) => x.persistence.available);
    const persistence: FacilityPersistenceKey = persistentCount > 0 ? "persistent" : events.length > 0 && judged.length === 0 ? "unavailable" : events.length >= 2 ? "recurring" : events.length === 1 ? "isolated" : "none";
    const riskStatus: FacilityRiskStatus = openTop ?? "normal";
    return {
      facility, events, total: events.length, byRisk, openCount: events.filter((x) => x.open).length, persistentCount,
      highest: top ? { eventId: top.event.id, level: top.assessment.riskLevel, score: top.assessment.riskScore } : null,
      riskStatus, persistence, persistenceLabel: PERSISTENCE_LABEL[persistence], lastEvent: events[0]?.event ?? null,
      meanPersistencePercent: judged.length ? Math.round(judged.reduce((a, x) => a + x.persistence.percent, 0) / judged.length) : 0,
      longestStreak: events.reduce((m, x) => Math.max(m, x.assessment.persistence.longestStreak), 0),
    };
  });
}
