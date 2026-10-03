import { useMemo } from "react";
import { buildFacilityStats } from "@/services/intelligence/facilities";
import { useAlerts } from "./useAlerts";
import { useThermalData } from "./useThermalData";

/** Facility statistics for the loaded dataset, recalculated when data or alert statuses change. */
export function useFacilityStats() {
  const { dataset, assessments } = useThermalData();
  const { openEventIds } = useAlerts();
  return useMemo(() => (dataset ? buildFacilityStats(dataset, assessments, openEventIds) : []), [dataset, assessments, openEventIds]);
}
