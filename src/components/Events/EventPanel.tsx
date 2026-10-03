import { useNavigate } from "react-router-dom";
import type { Facility, ThermalEvent } from "@/types";
import Icon from "@/components/common/Icon";
import { nearestFacility } from "@/services/geospatial/geo";
import { useThermalData } from "@/hooks/useThermalData";
import { useReportAction } from "@/hooks/useReportBuilder";
import { CLASS_LABEL, RISK_LABEL, formatCoord, formatIST, formatSensorConfidence } from "@/utils/format";
import { DataTag } from "@/components/common/SourceTag";

export default function EventPanel({ event, facilities }: { event: ThermalEvent | null; facilities: Facility[] }) {
  const navigate = useNavigate();
  const { assessments } = useThermalData();
  const a = event ? assessments[event.id] : undefined;
  const report = useReportAction();
  if (!event)
    return (
      <section className="event-panel empty-panel">
        <div className="eyebrow">NO EVENT SELECTED</div>
        <p>Select a thermal event on the map or in the detection feed to see its details.</p>
      </section>
    );
  const near = nearestFacility(event.lat, event.lon, facilities);
  const q = `?event=${event.id}`;
  return (
    <section className="event-panel" aria-label={`Details for ${event.id}`}>
      <div className="panel-header">
        <div><span className="eyebrow">SELECTED THERMAL EVENT</span><div className="event-id">Thermal Event <strong>{event.id}</strong></div></div>
        <DataTag />
      </div>
      <div className="classification">
        <span className="class-icon"><Icon name="flame" /></span>
        <div><small>AI-ASSISTED CLASSIFICATION</small><strong>{CLASS_LABEL[event.classification]}</strong></div>
        <span className={`risk-badge ${event.risk}`}>{RISK_LABEL[event.risk]}</span>
      </div>
      <div className="confidence-row"><span>AI confidence</span><strong>{a ? `${a.confidence}%` : "—"}</strong></div>
      <div className="confidence-track"><span style={{ width: `${a?.confidence ?? 0}%` }} /></div>
      <dl className="event-facts">
        <div><dt>Prototype Risk Score</dt><dd className="mono emphasis">{assessments[event.id] ? `${assessments[event.id].riskScore} / 100` : "—"}</dd></div>
        <div><dt>Detected</dt><dd>{formatIST(event.detectedAt)}</dd></div>
        <div><dt>Coordinates</dt><dd className="mono">{formatCoord(event.lat, event.lon)}</dd></div>
        <div><dt>Satellite</dt><dd>{event.instrument} / {event.satellite}</dd></div>
        <div><dt>FRP</dt><dd className="mono emphasis">{event.frpMw} MW</dd></div>
        <div><dt>Brightness temp.</dt><dd className="mono">{event.brightnessK} K</dd></div>
        {event.source === "firms" && <div><dt>Source</dt><dd>NASA FIRMS thermal anomaly</dd></div>}
        {event.source === "firms" && <div><dt>Sensor confidence</dt><dd className="mono">{formatSensorConfidence(event)}</dd></div>}
        <div><dt>Persistence</dt><dd className="mono">{a && !a.persistence.available ? "Unavailable (short FIRMS window)" : `${a?.persistence.active ?? event.persistenceActive} / ${a?.persistence.total ?? event.persistenceTotal} ${event.source === "firms" ? "FIRMS days" : "observations"}`}</dd></div>
        <div><dt>Nearest facility</dt><dd>{near ? near.facility.name : "—"}</dd></div>
        <div><dt>Facility distance</dt><dd className="mono">{near ? `${near.km.toFixed(2)} km` : "—"}</dd></div>
      </dl>
      <div className="panel-actions">
        <button className="primary-action" onClick={() => navigate(`/investigation${q}`)}><Icon name="scan" size={16} /> AI INVESTIGATE</button>
        <button className="secondary-action" onClick={() => navigate(`/history${q}`)}>VIEW HISTORY</button>
        <button className="secondary-action full" onClick={() => report.open(event.id)}><Icon name="file" size={15} /> {report.has(event.id) ? "VIEW REPORT" : "GENERATE REPORT"}</button>
      </div>
    </section>
  );
}
