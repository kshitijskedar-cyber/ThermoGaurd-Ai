import type { EventAssessment, RiskLevel, ThermalDataset, ThermalEvent } from "@/types";
import type { Alert, AlertOverrides, AlertPriority, AlertStatus, AlertSummary } from "@/types/intelligence";
import { persistenceStatus } from "./persistence";

export const PRIORITY_BY_RISK: Record<RiskLevel, { priority: AlertPriority; label: string }> = {
  critical: { priority: "critical", label: "Critical Alert" },
  high: { priority: "high", label: "High Priority Alert" },
  moderate: { priority: "monitoring", label: "Monitoring Alert" },
  low: { priority: "informational", label: "Informational / Low Priority" },
};

export const STATUS_LABEL: Record<AlertStatus, string> = { new: "NEW", investigating: "INVESTIGATING", resolved: "RESOLVED" };
export const STATUS_ORDER: AlertStatus[] = ["new", "investigating", "resolved"];

/** Alert ID derives from the event ID (TG-2026-00421 -> AL-00421) so the mapping is stable and reversible. */
export const alertIdFor = (eventId: string) => (/^(TG-\d{4}|FIRMS)-/.test(eventId) ? eventId.replace(/^(TG-\d{4}|FIRMS)-/, "AL-") : `AL-${eventId}`);

/** The demo dataset already carries an event workflow state; it seeds the alert status. "active" and "monitoring" both start as NEW. */
export function baseStatusFor(e: ThermalEvent): AlertStatus {
  return e.status === "resolved" ? "resolved" : e.status === "investigating" ? "investigating" : "new";
}

/** Pure: one alert per thermal event, risk taken from the Phase 2 engine. Sorted newest first. */
export function generateAlerts(ds: ThermalDataset, assessments: Record<string, EventAssessment>): Alert[] {
  const alerts: Alert[] = [];
  for (const e of ds.events) {
    const a = assessments[e.id];
    if (!a) continue;
    const p = PRIORITY_BY_RISK[a.riskLevel];
    const base = baseStatusFor(e);
    alerts.push({
      id: alertIdFor(e.id), eventId: e.id, timestamp: e.detectedAt, region: e.region, lat: e.lat, lon: e.lon,
      riskScore: a.riskScore, riskLevel: a.riskLevel, priority: p.priority, priorityLabel: p.label,
      classification: a.classification, confidence: a.confidence,
      nearest: a.nearest ? { facilityId: a.nearest.facility.id, name: a.nearest.facility.name, type: a.nearest.facility.type, km: a.nearest.km } : null,
      persistence: persistenceStatus(a.persistence), baseStatus: base, status: base,
    });
  }
  return alerts.sort((x, y) => Date.parse(y.timestamp) - Date.parse(x.timestamp));
}

export function applyOverrides(alerts: Alert[], overrides: AlertOverrides): Alert[] {
  return alerts.map((a) => (overrides[a.eventId] ? { ...a, status: overrides[a.eventId].status } : a));
}

/** Every KPI on the Alerts page comes from here. "Active" = not resolved. */
export function summariseAlerts(alerts: Alert[]): AlertSummary {
  const active = alerts.filter((a) => a.status !== "resolved");
  return {
    total: alerts.length, active: active.length,
    critical: active.filter((a) => a.riskLevel === "critical").length,
    high: active.filter((a) => a.riskLevel === "high").length,
    investigating: alerts.filter((a) => a.status === "investigating").length,
    resolved: alerts.filter((a) => a.status === "resolved").length,
  };
}
