import StatusDot from "@/components/common/StatusDot";
import Icon from "@/components/common/Icon";
import { useThermalData } from "@/hooks/useThermalData";

/** Compact DATA SOURCE indicator. Demo, live, partial-live and demo-fallback states are always distinguishable. */
export default function SourceChip() {
  const { source, dataset, status, refreshing, reload } = useThermalData();
  const canRefresh = !!dataset?.live; // only when live data was requested (a retry after a fallback is useful too)
  return (
    <>
      <div className={`demo-chip ${source.tone}`} role="status" aria-label="Data source" title={source.notes.join(" ") || undefined}>
        <StatusDot tone={source.tone} />
        <span><strong>{source.lines.join(" · ")}</strong><small>{source.detail}</small></span>
      </div>
      {canRefresh && (
        <button className={`icon-button refresh ${refreshing || status === "loading" ? "spin" : ""}`} onClick={reload} disabled={refreshing || status === "loading"}
          aria-label="Refresh live data" title={refreshing ? "Refreshing…" : "Refresh live data"}>
          <Icon name="refresh" size={16} />
        </button>
      )}
    </>
  );
}
