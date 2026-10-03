import { useThermalData } from "@/hooks/useThermalData";

/** Panel-header tag naming the data behind a panel: DEMO DATA, or NASA FIRMS in live mode. Never hides which mode is active. */
export function DataTag() {
  const { source } = useThermalData();
  return <span className={`demo-tag ${source.isLive ? "live" : ""}`}>{source.tag}</span>;
}

/** Tag for observation-history panels: SIMULATED HISTORY (demo) or the FIRMS observation window (live). */
export function HistoryTag() {
  const { source } = useThermalData();
  return <span className={`demo-tag ${source.isLive ? "live" : ""}`}>{source.historyTag}</span>;
}
