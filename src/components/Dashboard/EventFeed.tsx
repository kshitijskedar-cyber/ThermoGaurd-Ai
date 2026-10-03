import { useThermalData } from "@/hooks/useThermalData";
import StatusDot from "@/components/common/StatusDot";
import { CLASS_LABEL, RISK_LABEL, eventTone, formatTimeIST, toneDot } from "@/utils/format";

export default function EventFeed() {
  const { dataset, selectedId, select, source } = useThermalData();
  if (!dataset) return null;
  const rows = [...dataset.events].sort((a, b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt)).slice(0, 8);
  return (
    <section className="activity-strip">
      <div className="activity-head">
        <div><div className="section-title">Recent Detection Feed</div><div className="section-subtitle">{source.isLive ? "Latest NASA FIRMS thermal anomalies with ThermoGuard assessment" : "Latest events in the demonstration dataset"} · select a row to show it on the map</div></div>
      </div>
      <div className="event-table" role="table" aria-label="Recent detections">
        <div className="table-row table-head" role="row"><span>EVENT</span><span>CLASSIFICATION</span><span>SOURCE</span><span>FRP</span><span>RISK</span><span>DETECTED</span></div>
        {rows.map((e) => (
          <button key={e.id} role="row" className={`table-row feed-row ${selectedId === e.id ? "selected" : ""}`} onClick={() => select(e.id)}>
            <span className="event-code"><StatusDot tone={toneDot(eventTone(e))} /> {e.id}</span>
            <span>{CLASS_LABEL[e.classification]}</span>
            <span>{e.instrument} / {e.satellite}</span>
            <span className="mono">{e.frpMw} MW</span>
            <span><b className={`table-risk ${e.risk}`}>{RISK_LABEL[e.risk]}</b></span>
            <span className="mono">{formatTimeIST(e.detectedAt)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
