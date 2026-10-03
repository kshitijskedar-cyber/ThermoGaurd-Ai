import { Link } from "react-router-dom";
import type { FacilityEvent } from "@/types/intelligence";
import { AlertStatusChip, PersistenceChip } from "@/components/common/Chips";
import { RiskBadge } from "@/components/Investigation/parts";
import { useAlerts } from "@/hooks/useAlerts";
import { CLASS_LABEL, formatShortIST } from "@/utils/format";

/** Thermal events associated with a facility. Each row opens the existing Phase 2 AI Investigation for that event. */
export default function FacilityEvents({ events }: { events: FacilityEvent[] }) {
  const { forEvent } = useAlerts();
  if (!events.length) return <p className="inv-note">No thermal events lie within range of this facility in the loaded dataset.</p>;
  return (
    <>
      <div className="fev-head" aria-hidden="true"><span>EVENT</span><span>CLASSIFICATION</span><span>RISK</span><span>FRP</span><span>DISTANCE</span><span>PERSISTENCE</span><span>ALERT</span></div>
      <ul className="fev-list">
        {events.map(({ event: e, assessment: a, km, persistence }) => {
          const alert = forEvent(e.id);
          return (
            <li key={e.id}>
              <Link className={`fev-row sev-${a.riskLevel}`} to={`/investigation?event=${e.id}`} aria-label={`Open AI investigation for ${e.id}`}>
                <span className="fc" data-label="EVENT"><b className="mono">{e.id}</b><small className="mono">{formatShortIST(e.detectedAt)}</small></span>
                <span className="fc" data-label="CLASSIFICATION"><span>{CLASS_LABEL[a.classification]}</span><small>{a.confidence}% rule agreement</small></span>
                <span className="fc" data-label="RISK"><span className="risk-score-sm mono">{a.riskScore}</span><RiskBadge level={a.riskLevel} /></span>
                <span className="fc" data-label="FRP"><span className="mono">{e.frpMw} MW</span><small className="mono">{e.brightnessK} K</small></span>
                <span className="fc" data-label="DISTANCE"><span className="mono">{km.toFixed(2)} km</span></span>
                <span className="fc" data-label="PERSISTENCE"><PersistenceChip keyName={persistence.key} label={persistence.label} /><small className="mono">{persistence.active}/{persistence.total} days</small></span>
                <span className="fc" data-label="ALERT">{alert ? <AlertStatusChip status={alert.status} /> : <span className="muted">—</span>}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
