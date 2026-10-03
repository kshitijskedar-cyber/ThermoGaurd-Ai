import type { EventAssessment } from "@/types";
import type { ReportRecord } from "@/types/reports";

export interface ReportSummary { total: number; critical: number; high: number; recent: number; exported: number; drafts: number }
export const RECENT_HOURS = 24;

/** Pure. Risk levels come from the Phase 2 assessment of each report's event, so they always match the rest of the app. */
export function summariseReports(records: ReportRecord[], assessments: Record<string, EventAssessment>, nowMs: number): ReportSummary {
  const level = (r: ReportRecord) => assessments[r.eventId]?.riskLevel;
  return {
    total: records.length,
    critical: records.filter((r) => level(r) === "critical").length,
    high: records.filter((r) => level(r) === "high").length,
    recent: records.filter((r) => r.status !== "draft" && nowMs - Date.parse(r.generatedAt) <= RECENT_HOURS * 3600_000).length,
    exported: records.filter((r) => r.status === "exported").length,
    drafts: records.filter((r) => r.status === "draft").length,
  };
}
