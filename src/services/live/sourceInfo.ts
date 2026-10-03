import type { ThermalDataset } from "@/types";
import { formatTimeIST } from "@/utils/format";

/**
 * Pure description of where the loaded data came from, so every screen words it identically and never presents demo
 * data as live. NASA FIRMS supplies thermal-anomaly observations; OpenStreetMap supplies infrastructure context; the
 * classification and risk level are ThermoGuard's own prototype assessment.
 */
export type SourceKind = "demo" | "live" | "live_partial" | "live_empty" | "fallback";
export type SourceTone = "amber" | "green" | "red" | "blue";

export interface SourceInfo {
  kind: SourceKind;
  isLive: boolean;
  /** Compact chip items, for example ["LIVE FIRMS", "OSM CONTEXT"]. */
  lines: string[];
  /** Second line of the chip: "Updated 14:32 IST" or "Controlled Demonstration Dataset". */
  detail: string;
  tone: SourceTone;
  /** Short tag for panel headers. */
  tag: string;
  historyTag: string;
  /** Scope noun used in captions: "demonstration dataset" / "live NASA FIRMS data". */
  scope: string;
  thermalSource: string;
  facilitySource: string;
  /** Time shown next to the data: the FIRMS fetch time in live mode, the fixed snapshot in demo mode. */
  updatedAt: string;
  updatedLabel: string;
  /** Notes explaining a degraded state (OSM unavailable, FIRMS fallback, area limits). */
  notes: string[];
}

export function describeSource(ds: ThermalDataset | null): SourceInfo {
  if (!ds) return { kind: "demo", isLive: false, lines: ["LOADING"], detail: "", tone: "amber", tag: "", historyTag: "", scope: "", thermalSource: "", facilitySource: "", updatedAt: "", updatedLabel: "", notes: [] };
  const notes = ds.live?.messages ?? [];
  const demoBase = {
    isLive: false, tag: "DEMO DATA", historyTag: "SIMULATED HISTORY", scope: "demonstration dataset", thermalSource: "Demonstration dataset (simulated)",
    facilitySource: "Demonstration dataset (fictional names)", updatedAt: ds.referenceTime, updatedLabel: "DEMO SNAPSHOT",
  };
  if (ds.mode === "demo") {
    if (ds.live && !ds.live.thermalOk)
      return { ...demoBase, kind: "fallback", lines: ["LIVE DATA UNAVAILABLE", "DEMO FALLBACK"], detail: "Controlled Demonstration Dataset", tone: "red", notes };
    return { ...demoBase, kind: "demo", lines: ["DEMO DATA"], detail: "Controlled Demonstration Dataset", tone: "amber", notes };
  }
  const osmOk = ds.live?.facilitiesOk === true;
  const empty = ds.events.length === 0;
  const updated = ds.live?.fetchedAt ?? ds.referenceTime;
  const days = ds.historyWindowDays ?? ds.live?.firms?.dayRange ?? 0;
  const base = {
    isLive: true, tag: "NASA FIRMS", historyTag: `FIRMS WINDOW · ${days} ${days === 1 ? "DAY" : "DAYS"}`, scope: "live NASA FIRMS data", thermalSource: "NASA FIRMS (satellite-observed thermal anomalies)",
    facilitySource: osmOk ? "OpenStreetMap (Overpass)" : "OpenStreetMap unavailable", updatedAt: updated, updatedLabel: "FIRMS UPDATED", detail: `Updated ${formatTimeIST(updated)}`, notes,
  };
  if (empty) return { ...base, kind: "live_empty", lines: ["LIVE FIRMS", "NO ANOMALIES"], tone: "green" };
  if (!osmOk) return { ...base, kind: "live_partial", lines: ["LIVE FIRMS", "OSM UNAVAILABLE"], tone: "amber" };
  return { ...base, kind: "live", lines: ["LIVE FIRMS", "OSM CONTEXT"], tone: "green" };
}
