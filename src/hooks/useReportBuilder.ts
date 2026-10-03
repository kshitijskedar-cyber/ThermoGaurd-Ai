import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { ReportContent, ReportRecord } from "@/types/reports";
import { buildReportContent } from "@/services/reports/content";
import { useAlerts } from "./useAlerts";
import { useFacilityStats } from "./useFacilityStats";
import { useReports } from "./useReports";
import { useThermalData } from "./useThermalData";

/** Builds report content for an event from the same dataset, assessments, alerts and facility statistics the rest of the app uses. */
export function useReportBuilder() {
  const { dataset, assessments } = useThermalData();
  const { forEvent: alertFor } = useAlerts();
  const { forEvent: recordFor } = useReports();
  const facilityStats = useFacilityStats();
  return useCallback((eventId: string, record?: ReportRecord): ReportContent | null => {
    const event = dataset?.events.find((e) => e.id === eventId);
    const assessment = assessments[eventId];
    if (!dataset || !event || !assessment) return null;
    return buildReportContent({ dataset, event, assessment, alert: alertFor(eventId), facilityStats, record: record ?? recordFor(eventId) });
  }, [dataset, assessments, alertFor, facilityStats, recordFor]);
}

/** Shared by Investigation and Alert detail: generate (when needed) and open the report preview for an event. */
export function useReportAction() {
  const { forEvent, generate } = useReports();
  const { select } = useThermalData();
  const navigate = useNavigate();
  return {
    has: (eventId: string) => { const r = forEvent(eventId); return !!r && r.status !== "draft"; },
    open: (eventId: string) => {
      const r = forEvent(eventId);
      if (!r || r.status === "draft") generate(eventId);
      select(eventId);
      navigate(`/reports?event=${eventId}`);
    },
  };
}

/** PDF export used by both the report preview and the report history. Generates the report first when it is missing or a draft, then marks it EXPORTED on success. */
export function useReportExport() {
  const build = useReportBuilder();
  const { forEvent, generate, markExported } = useReports();
  return useCallback(async (eventId: string): Promise<void> => {
    const existing = forEvent(eventId);
    const record = !existing || existing.status === "draft" ? generate(eventId) : existing;
    const content = build(eventId, record);
    if (!content) throw new Error("The selected thermal event is not available in the loaded dataset.");
    const { exportReportPdf } = await import("@/services/reports/pdf");
    await exportReportPdf(content);
    markExported(eventId);
  }, [build, forEvent, generate, markExported]);
}
