import type { ThermalDataset } from "@/types";
import type { IconName } from "@/components/common/Icon";
import { MIN_HISTORY_DAYS } from "@/services/analysis/engine";

export interface Kpi { label: string; value: number; note: string; icon: IconName; tone: string }

/** All KPI values are derived from the loaded dataset. "Open" = not resolved. */
export function computeKpis(ds: ThermalDataset): Kpi[] {
  const ref = Date.parse(ds.referenceTime);
  const open = ds.events.filter((e) => e.status !== "resolved");
  const last24 = open.filter((e) => ref - Date.parse(e.detectedAt) <= 864e5).length;
  const high = open.filter((e) => e.risk === "critical" || e.risk === "high");
  const critical = high.filter((e) => e.risk === "critical").length;
  const live = ds.mode === "live";
  // Live: only events with enough FIRMS observation days can be judged; the rest are not counted rather than guessed.
  const persistent = open.filter((e) => e.persistenceTotal >= (live ? MIN_HISTORY_DAYS : 1) && e.persistenceActive / e.persistenceTotal >= 0.6).length;
  // Live regions are 0.5° grid cells (FIRMS carries no place names); OSM address tags are optional and often missing, so only event cells are counted.
  const regions = new Set(live ? ds.events.map((e) => e.region) : [...ds.events.map((e) => e.region), ...ds.facilities.map((f) => f.region)]).size;
  const types = new Set(ds.facilities.map((f) => f.type)).size;
  return [
    { label: "Active Thermal Events", value: open.length, note: `${last24} in last 24 h`, icon: "flame", tone: "orange" },
    { label: live ? "Industrial Context (OSM)" : "Industrial Sources", value: ds.facilities.length, note: live && ds.sources?.facilities !== "OpenStreetMap" ? "OpenStreetMap unavailable" : `${types} facility types${live ? " · OpenStreetMap" : ""}`, icon: "factory", tone: "blue" },
    { label: "High-Risk Events", value: high.length, note: `${critical} critical`, icon: "shield", tone: "red" },
    { label: "Persistent Sources", value: persistent, note: live ? `≥ 60% of ${ds.historyWindowDays ?? 5}-day FIRMS window` : "persistence ≥ 6 / 10", icon: "clock", tone: "amber" },
    { label: "Areas Monitored", value: regions, note: live ? "0.5° grid cells with events" : "regions in dataset", icon: "map", tone: "green" },
  ];
}
