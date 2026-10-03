import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { Alert, AlertStatus } from "@/types/intelligence";
import Icon from "@/components/common/Icon";
import { AlertStatusChip, PersistenceChip } from "@/components/common/Chips";
import { EvidenceList, PersistenceSummary, RiskBadge, RiskMeter } from "@/components/Investigation/parts";
import { useAlerts } from "@/hooks/useAlerts";
import { useThermalData } from "@/hooks/useThermalData";
import { useReportAction } from "@/hooks/useReportBuilder";
import { RELATED_RADIUS_KM } from "@/services/intelligence/facilities";
import { STATUS_LABEL, STATUS_ORDER } from "@/services/intelligence/alerts";
import { CLASS_LABEL, formatCoord, formatIST } from "@/utils/format";
import { DataTag } from "@/components/common/SourceTag";

const STATUS_HELP: Record<AlertStatus, string> = {
  new: "Not yet triaged.",
  investigating: "An analyst is reviewing this event.",
  resolved: "Closed. It no longer counts as an active alert.",
};

/**
 * Alert detail. Side drawer on desktop, full-height bottom sheet on mobile (CSS). Every analytical block is the Phase 2
 * component fed by the existing assessment for the event, so the alert and the AI Investigation can never disagree.
 */
export default function AlertDetailPanel({ alert: a, onClose }: { alert: Alert; onClose: () => void }) {
  const { assessments, dataset, select } = useThermalData();
  const { setStatus, overrides } = useAlerts();
  const navigate = useNavigate();
  const report = useReportAction();
  const closeRef = useRef<HTMLButtonElement>(null);
  const assessment = assessments[a.eventId];
  const event = dataset?.events.find((e) => e.id === a.eventId);
  const log = overrides[a.eventId]?.log ?? [];

  const closeFn = useRef(onClose);
  closeFn.current = onClose;
  useEffect(() => {
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeFn.current(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prevOverflow; window.removeEventListener("keydown", onKey); };
  }, []);

  if (!assessment || !event) return null;
  const q = `?event=${a.eventId}`;
  const goInvestigate = () => { select(a.eventId); navigate(`/investigation${q}`); };
  const goMap = () => { select(a.eventId); navigate("/map"); };
  const facilityLink = a.nearest && a.nearest.km <= RELATED_RADIUS_KM ? a.nearest : null;

  return (
    <>
      <button className="sheet-backdrop" aria-label="Close alert detail" onClick={onClose} tabIndex={-1} />
      <aside className={`sheet sev-${a.riskLevel}`} role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <header className="sheet-head">
          <div>
            <div className="eyebrow">ALERT <span className="mono">{a.id}</span> · <span className="mono">{a.eventId}</span></div>
            <h2 id="sheet-title" className="sheet-title">{a.priorityLabel}</h2>
            <div className="sheet-sub">{CLASS_LABEL[a.classification]} · {a.region}</div>
          </div>
          <div className="sheet-head-side">
            <DataTag />
            <button ref={closeRef} className="icon-button" onClick={onClose} aria-label="Close alert detail"><Icon name="close" /></button>
          </div>
        </header>

        <div className="sheet-body">
          <section className="sheet-sec" aria-labelledby="sh-status">
            <div className="sheet-sec-head"><h3 id="sh-status" className="eyebrow">ALERT STATUS</h3><AlertStatusChip status={a.status} /></div>
            <div className="seg full" role="group" aria-label="Change alert status">
              {STATUS_ORDER.map((s) => (
                <button key={s} className={`${a.status === s ? "active" : ""} st-${s}`} aria-pressed={a.status === s} onClick={() => setStatus(a.eventId, s)}>{STATUS_LABEL[s]}</button>
              ))}
            </div>
            <p className="inv-note">{STATUS_HELP[a.status]}</p>
          </section>

          <section className="sheet-sec" aria-labelledby="sh-risk">
            <h3 id="sh-risk" className="eyebrow">PROTOTYPE RISK SCORE</h3>
            <RiskMeter score={assessment.riskScore} level={assessment.riskLevel} />
          </section>

          <section className="sheet-sec" aria-labelledby="sh-facts">
            <h3 id="sh-facts" className="eyebrow">ALERT DETAILS</h3>
            <dl className="kv">
              <div><dt>Alert ID</dt><dd className="mono">{a.id}</dd></div>
              <div><dt>Event ID</dt><dd className="mono">{a.eventId}</dd></div>
              <div><dt>Detected</dt><dd className="mono">{formatIST(a.timestamp)}</dd></div>
              <div><dt>Location</dt><dd>{a.region}</dd></div>
              <div><dt>Coordinates</dt><dd className="mono">{formatCoord(a.lat, a.lon)}</dd></div>
              <div><dt>Classification</dt><dd>{CLASS_LABEL[a.classification]}</dd></div>
              <div><dt>Risk level</dt><dd><RiskBadge level={a.riskLevel} /></dd></div>
              <div><dt>Industrial site</dt><dd>{a.nearest ? `${a.nearest.name} · ${a.nearest.km.toFixed(2)} km` : "None in dataset"}</dd></div>
              <div><dt>Persistence</dt><dd><PersistenceChip keyName={a.persistence.key} label={a.persistence.label} /></dd></div>
              <div><dt>Source</dt><dd>{event.source === "firms" ? "NASA FIRMS observation → ThermoGuard assessment" : "Demonstration dataset"}</dd></div>
              <div><dt>FRP / brightness</dt><dd className="mono">{event.frpMw} MW · {event.brightnessK} K</dd></div>
            </dl>
          </section>

          <section className="sheet-sec" aria-labelledby="sh-why">
            <h3 id="sh-why" className="eyebrow">WHY THIS ALERT WAS RAISED</h3>
            <EvidenceList a={assessment} />
          </section>

          <section className="sheet-sec" aria-labelledby="sh-pers">
            <h3 id="sh-pers" className="eyebrow">PERSISTENCE · {assessment.persistence.total}-DAY WINDOW</h3>
            <PersistenceSummary a={assessment} />
          </section>

          <section className="sheet-sec" aria-labelledby="sh-log">
            <h3 id="sh-log" className="eyebrow">STATUS HISTORY</h3>
            <ul className="status-log">
              <li><span className="mono">{formatIST(a.timestamp)}</span><span>Alert raised from event detection · initial status <b>{STATUS_LABEL[a.baseStatus]}</b></span></li>
              {log.map((l, i) => <li key={i}><span className="mono">{formatIST(l.at)}</span><span>Analyst changed status <b>{STATUS_LABEL[l.from]}</b> → <b>{STATUS_LABEL[l.to]}</b></span></li>)}
            </ul>
          </section>
        </div>

        <footer className="sheet-actions">
          <button className="primary-action" onClick={goInvestigate}><Icon name="scan" size={15} /> AI INVESTIGATE</button>
          <button className="secondary-action" onClick={() => navigate(`/history${q}`)}><Icon name="clock" size={15} /> EVENT HISTORY</button>
          <button className="secondary-action" onClick={() => report.open(a.eventId)}><Icon name="file" size={15} /> {report.has(a.eventId) ? "VIEW REPORT" : "GENERATE REPORT"}</button>
          <button className="secondary-action" onClick={goMap}><Icon name="map" size={15} /> VIEW ON MAP</button>
          {facilityLink && <button className="secondary-action" onClick={() => navigate(`/sites/${facilityLink.facilityId}`)}><Icon name="factory" size={15} /> FACILITY</button>}
        </footer>
      </aside>
    </>
  );
}
