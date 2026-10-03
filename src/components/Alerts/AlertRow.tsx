import { Link } from "react-router-dom";
import type { Alert, AlertStatus } from "@/types/intelligence";
import { RiskBadge } from "@/components/Investigation/parts";
import { PersistenceChip } from "@/components/common/Chips";
import { STATUS_LABEL, STATUS_ORDER } from "@/services/intelligence/alerts";
import { CLASS_LABEL, formatCoord, formatShortIST } from "@/utils/format";

interface Props { alert: Alert; openTo: string; onStatus: (eventId: string, s: AlertStatus) => void; selected?: boolean }

/**
 * One alert. The whole row opens the detail panel through a stretched link; the status control sits above that link,
 * so changing status never navigates. Below 1180px the same markup renders as a card (labels come from data-label).
 */
export default function AlertRow({ alert: a, openTo, onStatus, selected }: Props) {
  return (
    <li className={`alert-row sev-${a.riskLevel} st-${a.status} ${selected ? "selected" : ""}`}>
      <Link className="row-hit" to={{ search: openTo }} aria-label={`Open alert ${a.id}, ${a.priorityLabel}, event ${a.eventId}`} />
      <div className="ac c-alert" data-label="ALERT"><b className="mono">{a.id}</b><small>{a.priorityLabel}</small><small className="mono">{a.eventId}</small></div>
      <div className="ac c-when" data-label="DETECTED · LOCATION"><span className="mono">{formatShortIST(a.timestamp)}</span><span>{a.region}</span><small className="mono">{formatCoord(a.lat, a.lon)}</small></div>
      <div className="ac c-class" data-label="CLASSIFICATION"><span>{CLASS_LABEL[a.classification]}</span><small>{a.confidence}% rule agreement</small></div>
      <div className="ac c-risk" data-label="RISK"><span className="risk-score-sm mono">{a.riskScore}</span><RiskBadge level={a.riskLevel} /></div>
      <div className="ac c-prox" data-label="NEAREST SITE">
        {a.nearest ? <><span>{a.nearest.name}</span><small className="mono">{a.nearest.km.toFixed(2)} km · {a.nearest.type}</small></> : <span className="muted">No facility in dataset</span>}
      </div>
      <div className="ac c-pers" data-label="PERSISTENCE"><PersistenceChip keyName={a.persistence.key} label={a.persistence.label} /><small className="mono">{a.persistence.active}/{a.persistence.total} days</small></div>
      <div className="ac c-status" data-label="STATUS">
        <select className={`status-select st-${a.status}`} value={a.status} aria-label={`Status of alert ${a.id}`} onChange={(e) => onStatus(a.eventId, e.target.value as AlertStatus)}>
          {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>
    </li>
  );
}
