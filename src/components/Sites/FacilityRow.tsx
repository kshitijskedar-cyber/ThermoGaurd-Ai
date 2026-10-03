import { Link } from "react-router-dom";
import type { FacilityStats } from "@/types/intelligence";
import { PersistenceChip, RiskStatusBadge } from "@/components/common/Chips";
import { formatShortIST } from "@/utils/format";

/** One facility in the Industrial Sites list. The row is a single link to Facility Intelligence; below 1100px it renders as a card. */
export default function FacilityRow({ s }: { s: FacilityStats }) {
  const f = s.facility;
  return (
    <li>
      <Link className={`site-row risk-${s.riskStatus}`} to={`/sites/${f.id}`} aria-label={`Open facility intelligence for ${f.name}`}>
        <span className="sc sc-name" data-label="FACILITY"><b>{f.name}</b><small>{f.type}</small></span>
        <span className="sc" data-label="LOCATION"><span>{f.region}</span><small className="mono">{f.lat.toFixed(2)}°N, {f.lon.toFixed(2)}°E</small></span>
        <span className="sc" data-label="RISK STATUS"><RiskStatusBadge status={s.riskStatus} /></span>
        <span className="sc" data-label="NEARBY EVENTS"><b className="mono">{s.total}</b><small>{s.openCount} open</small></span>
        <span className="sc" data-label="HIGHEST NEARBY RISK">{s.highest ? <><RiskStatusBadge status={s.highest.level} /><small className="mono">score {s.highest.score}</small></> : <span className="muted">—</span>}</span>
        <span className="sc" data-label="PERSISTENT ACTIVITY"><PersistenceChip keyName={s.persistence} label={s.persistenceLabel} /></span>
        <span className="sc" data-label="LAST DETECTED">{s.lastEvent ? <><span className="mono">{formatShortIST(s.lastEvent.detectedAt)}</span><small className="mono">{s.lastEvent.id}</small></> : <span className="muted">No events</span>}</span>
      </Link>
    </li>
  );
}
