import type { ReactNode } from "react";
import type { ReportContent } from "@/types/reports";
import { FactorBars, PersistenceChart, RiskBadge, RiskMeter } from "@/components/Investigation/parts";
import { AlertStatusChip, PersistenceChip } from "@/components/common/Chips";
import { DEMO_DISCLAIMER_LONG, LIVE_BANNER_TITLE, METHOD_NOTE, REPORT_STATUS_LABEL, days } from "@/services/reports/content";
import { formatIST } from "@/utils/format";
import type { ThermalEvent } from "@/types";
import ReportMapPanel from "./ReportMapPanel";

function Sec({ n, title, children, aside }: { n: number; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rpt-sec" aria-labelledby={`rpt-s${n}`}>
      <h3 id={`rpt-s${n}`}><span className="rpt-n" aria-hidden="true">{n}</span>{title}{aside && <span className="rpt-aside">{aside}</span>}</h3>
      {children}
    </section>
  );
}

/** The on-screen report. It renders a ReportContent only (no calculations), the same object the PDF is built from. */
export default function ReportDocument({ c, event }: { c: ReportContent; event: ThermalEvent }) {
  const p = c.persistence, ind = c.industrial;
  return (
    <article className="report rpt" aria-label={`Thermal event investigation report ${c.reportId}`}>
      <header className="rpt-head">
        <div className="rpt-title">
          <div className="rpt-brand">THERMOGUARD AI</div>
          <h2>THERMAL EVENT INVESTIGATION REPORT</h2>
        </div>
        <div className="rpt-head-risk"><span className={`risk-num ${c.riskLevel}`}>{c.riskScore}</span><span className="risk-of">/ 100</span><RiskBadge level={c.riskLevel} /></div>
        <dl className="rpt-meta">
          <div><dt>Report ID</dt><dd className="mono">{c.reportId}</dd></div>
          <div><dt>Event ID</dt><dd className="mono">{c.eventId}</dd></div>
          <div><dt>Generated</dt><dd className="mono">{formatIST(c.generatedAt)}</dd></div>
          <div><dt>Investigation status</dt><dd>{c.alertStatus ? <AlertStatusChip status={c.alertStatus} /> : c.investigationStatus}</dd></div>
          <div><dt>Alert ID</dt><dd className="mono">{c.alertId ?? "—"}</dd></div>
          <div><dt>Report status</dt><dd>{c.recordStatus === "unsaved" ? <span className="chip rstatus-unsaved">PREVIEW</span> : <span className={`chip rstatus-${c.recordStatus}`}>{REPORT_STATUS_LABEL[c.recordStatus]}</span>}</dd></div>
        </dl>
      </header>

      {c.disclaimer && (
        <div className="rpt-demo" role="note">
          <strong>{c.disclaimer}</strong>
          <span>Simulated events, facilities and history. Not a live NASA FIRMS detection and not a real emergency.</span>
        </div>
      )}

      {c.liveNote && (
        <div className="rpt-demo live" role="note">
          <strong>{LIVE_BANNER_TITLE}</strong>
          <span>{c.liveNote}</span>
        </div>
      )}

      <Sec n={1} title="Event Overview">
        <dl className="rpt-kv">{c.overview.map((f) => <div key={f.label}><dt>{f.label}</dt><dd className={f.mono ? "mono" : ""}>{f.value}</dd></div>)}</dl>
      </Sec>

      <Sec n={2} title="Map / Geospatial Context"><ReportMapPanel geometry={c.map} event={event} assessment={c.assessment} /></Sec>

      <Sec n={3} title="AI-Assisted Geospatial Classification">
        <div className="rpt-class">
          <div><small>FINAL CLASSIFICATION</small><strong>{c.classification.label}</strong><span>Operational group: {c.classification.group}</span></div>
          <div className="rpt-conf"><small>CONFIDENCE (RULE AGREEMENT)</small><strong className="mono">{c.classification.confidence}%</strong><span className="confidence-track wide"><span style={{ width: `${c.classification.confidence}%` }} /></span></div>
        </div>
        <p className="rpt-p">{c.classification.method}</p>
        {c.classification.basis.length > 0 && (
          <>
            <div className="eyebrow sub">CLASSIFICATION FACTORS</div>
            <ul className="basis">{c.classification.basis.map((b) => <li key={b.label}><span>{b.label}</span><span className="mono">{b.score}%</span></li>)}</ul>
          </>
        )}
        <p className="rpt-note">{METHOD_NOTE}</p>
      </Sec>

      <Sec n={4} title="Why This Event Was Flagged">
        {c.flagged.length ? (
          <ul className="rpt-evidence">{c.flagged.map((f) => <li key={f.key}><strong>{f.text}</strong><small>{f.detail}</small></li>)}</ul>
        ) : <p className="rpt-p muted">No individual factor reached the 50% evidence threshold, so no supporting evidence is listed for this event.</p>}
        <p className="rpt-foot">Only factors at or above 50% from this event's own analysis are listed.</p>
      </Sec>

      <Sec n={5} title="Risk Assessment">
        <RiskMeter score={c.riskScore} level={c.riskLevel} />
        <div className="eyebrow sub">CONTRIBUTING RISK FACTORS</div>
        <FactorBars factors={c.factors} showDetail />
      </Sec>

      <Sec n={6} title="Persistence Analysis" aside={<span className={`demo-tag ${c.isDemo ? "" : "live"}`}>{c.historyTag}</span>}>
        <dl className="rpt-kv">
          <div><dt>Persistence status</dt><dd><PersistenceChip keyName={p.key} label={p.label} /></dd></div>
          <div><dt>Related / repeated detections</dt><dd className="mono">{p.hasHistory ? `${p.active} of ${p.total} days (${p.percent}%)` : "Not available"}</dd></div>
          <div><dt>First detected activity</dt><dd>{p.firstActive ?? "Not available"}</dd></div>
          <div><dt>Most recent activity</dt><dd>{p.lastActive ?? "Not available"}</dd></div>
          <div><dt>Longest streak</dt><dd className="mono">{p.hasHistory ? days(p.longestStreak) : "Not available"}</dd></div>
          <div><dt>Current streak</dt><dd className="mono">{p.hasHistory ? days(p.currentStreak) : "Not available"}</dd></div>
        </dl>
        <p className="rpt-p">{p.meaning}</p>
        <p className="rpt-p"><strong>Historical trend.</strong> {p.trend}</p>
        {p.hasHistory ? <PersistenceChart obs={p.history} baseline={p.baseline} /> : <p className="rpt-p muted">{p.available ? "No observation history is available for this event, so no persistence timeline can be shown." : "Historical persistence unavailable for this live observation, so no persistence timeline is shown. No history is simulated."}</p>}
      </Sec>

      <Sec n={7} title="Industrial Context">
        {ind.rows.length === 0 ? <p className="rpt-p muted">{ind.emptyNote}</p> : (
          <>
            <p className="rpt-p">Land-use context: {ind.land}.</p>
            <div className="rpt-table-wrap">
              <table className="rpt-table">
                <thead><tr><th>Ref</th><th>Facility</th><th>Type</th><th>Distance</th><th>Zone</th><th>Related events</th><th>Facility risk</th></tr></thead>
                <tbody>{ind.rows.map((r) => (
                  <tr key={r.label}>
                    <td className="mono">{r.label}</td><td><strong>{r.name}</strong></td><td>{r.type}</td><td className="mono">{r.km.toFixed(2)} km</td>
                    <td>{r.inZone ? "Inside 1 km" : "Outside 1 km"}</td>
                    <td>{r.relatedEvents == null ? "n/a" : `${r.relatedEvents} (${r.openEvents ?? 0} open)`}</td>
                    <td>{r.facilityRisk ?? "n/a"}</td>
                  </tr>))}</tbody>
              </table>
            </div>
            {ind.nearest && <p className="rpt-p">Nearest facility: <strong>{ind.nearest.name}</strong> ({ind.nearest.type}), {ind.nearest.km.toFixed(2)} km from the event{ind.nearest.facilityPersistence ? `; facility-level thermal activity: ${ind.nearest.facilityPersistence.toLowerCase()}` : ""}.</p>}
            <p className="rpt-foot">{ind.note}</p>
          </>
        )}
      </Sec>

      <Sec n={8} title="Investigation Summary"><p className="rpt-p rpt-summary">{c.summary}</p></Sec>

      <Sec n={9} title="Prototype Decision Support">
        <div className={`rpt-decision ${c.decision.level}`}>
          <strong>{c.decision.headline}</strong>
          <ul>{c.decision.steps.map((s) => <li key={s}>{s}</li>)}</ul>
          <small>{c.decision.caveat}</small>
        </div>
      </Sec>

      <footer className="report-foot">
        <strong>{c.isDemo ? c.disclaimer : "Prototype report"}.</strong> {c.isDemo ? DEMO_DISCLAIMER_LONG : c.liveNote} Classification and risk score come from a transparent rule-based prototype; no trained machine-learning or deep-learning model is used.
      </footer>
    </article>
  );
}
