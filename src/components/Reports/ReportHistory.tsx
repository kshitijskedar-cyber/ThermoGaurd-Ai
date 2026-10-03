import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon from "@/components/common/Icon";
import StateBlock from "@/components/common/StateBlock";
import StatCards from "@/components/common/StatCards";
import { Panel, RiskBadge } from "@/components/Investigation/parts";
import { useReports } from "@/hooks/useReports";
import { useReportExport } from "@/hooks/useReportBuilder";
import { useThermalData } from "@/hooks/useThermalData";
import { REPORT_STATUS_LABEL } from "@/services/reports/content";
import { summariseReports, RECENT_HOURS } from "@/services/reports/summary";
import { CLASS_LABEL, formatIST } from "@/utils/format";
import type { Kpi } from "@/utils/kpis";
import { DataTag } from "@/components/common/SourceTag";

export default function ReportHistory() {
  const { dataset, assessments, selectedId, select } = useThermalData();
  const { records, generate, persisted } = useReports();
  const exportPdf = useReportExport();
  const navigate = useNavigate();
  const [pick, setPick] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ eventId: string; message: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const events = useMemo(() => [...(dataset?.events ?? [])].sort((a, b) => (assessments[b.id]?.riskScore ?? 0) - (assessments[a.id]?.riskScore ?? 0)), [dataset, assessments]);
  const chosen = pick || selectedId || events[0]?.id || "";
  // Reports saved for events that are not in the currently loaded dataset (for example demo reports while live data is shown) are not listed or counted.
  const shown = useMemo(() => records.filter((r) => dataset?.events.some((e) => e.id === r.eventId) && assessments[r.eventId]), [records, dataset, assessments]);
  const summary = summariseReports(shown, assessments, Date.now());
  const kpis: Kpi[] = [
    { label: "Total Reports", value: summary.total, note: `${summary.exported} exported${summary.drafts ? ` · ${summary.drafts} draft` : ""}`, icon: "file", tone: "blue" },
    { label: "Critical Reports", value: summary.critical, note: "risk 81–100", icon: "flame", tone: "red" },
    { label: "High-Risk Reports", value: summary.high, note: "risk 61–80", icon: "shield", tone: "orange" },
    { label: "Generated Recently", value: summary.recent, note: `last ${RECENT_HOURS} h`, icon: "clock", tone: "amber" },
  ];

  const onGenerate = (eventId: string) => {
    if (!eventId) return;
    generate(eventId); select(eventId); navigate(`/reports?event=${eventId}`);
  };
  const onRegenerate = (eventId: string) => { generate(eventId); setNotice(`Report ${records.find((r) => r.eventId === eventId)?.id ?? ""} regenerated from the current assessment.`); };
  const onExport = async (eventId: string) => {
    setBusy(eventId); setError(null); setNotice(null);
    try { await exportPdf(eventId); }
    catch (e) { setError({ eventId, message: e instanceof Error ? e.message : "Unknown error" }); }
    finally { setBusy(null); }
  };

  return (
    <div className="inv reports-page">
      <StatCards kpis={kpis} label="Report indicators" columns={4} wrap />

      <Panel eyebrow="NEW REPORT" title="Generate an Investigation Report" aside={<DataTag />}>
        <div className="rh-gen">
          <label className="inv-picker">
            <span className="eyebrow">THERMAL EVENT</span>
            <select value={chosen} onChange={(e) => setPick(e.target.value)} aria-label="Select thermal event for the report">
              {events.map((e) => <option key={e.id} value={e.id}>{e.id} · {CLASS_LABEL[e.classification]} · score {assessments[e.id]?.riskScore ?? "–"}</option>)}
            </select>
          </label>
          <button className="primary-action rh-btn" onClick={() => onGenerate(chosen)} disabled={!chosen}><Icon name="file" size={15} /> GENERATE REPORT</button>
        </div>
        <p className="inv-foot">A report is built from the event's existing AI Investigation. You can also start one from AI Investigation or an alert.</p>
      </Panel>

      <Panel eyebrow="REPORT HISTORY" title="Generated Reports" aside={<DataTag />}>
        {!persisted && <p className="rh-warn" role="status">This browser blocked local storage, so report history will last for this session only.</p>}
        {error && (
          <div className="rh-error" role="alert">
            <strong>PDF export failed for {error.eventId}.</strong> {error.message} <button className="plain-button" onClick={() => onExport(error.eventId)}>Try again</button>
          </div>
        )}
        {notice && <p className="rh-notice" role="status">{notice}</p>}
        {shown.length === 0 ? (
          <StateBlock variant="empty" icon="file" title="No reports yet" detail="Choose a thermal event above and select Generate Report. Generated reports are listed here and kept in this browser. Reports belong to the data they were built from: those for events not in the current dataset are hidden." />
        ) : (
          <>
            <div className="rh-head" aria-hidden="true"><span>REPORT / EVENT</span><span>GENERATED</span><span>LOCATION</span><span>CLASSIFICATION</span><span>RISK</span><span>STATUS</span><span>ACTIONS</span></div>
            <ul className="rh-list">
              {shown.map((r) => {
                const e = dataset?.events.find((x) => x.id === r.eventId), a = assessments[r.eventId];
                if (!e || !a) return null;
                return (
                  <li key={r.id} className={`rh-row sev-${a.riskLevel}`}>
                    <span className="rc" data-label="REPORT / EVENT"><b className="mono">{r.id}</b><small className="mono">{r.eventId}</small></span>
                    <span className="rc" data-label="GENERATED"><span className="mono">{r.status === "draft" ? "Draft saved" : formatIST(r.generatedAt)}</span>{r.status !== "draft" && r.revision > 1 && <small>revision {r.revision}</small>}{r.status === "draft" && <small className="mono">{formatIST(r.generatedAt)}</small>}</span>
                    <span className="rc" data-label="LOCATION"><span>{e.region}</span></span>
                    <span className="rc" data-label="CLASSIFICATION"><span>{CLASS_LABEL[a.classification]}</span><small>{a.confidence}% rule agreement</small></span>
                    <span className="rc" data-label="RISK"><span className="risk-score-sm mono">{a.riskScore}</span><RiskBadge level={a.riskLevel} /></span>
                    <span className="rc" data-label="STATUS"><span className={`chip rstatus-${r.status}`}>{REPORT_STATUS_LABEL[r.status]}</span>{r.exportedAt && <small className="mono">{formatIST(r.exportedAt)}</small>}</span>
                    <span className="rc rh-actions" data-label="ACTIONS">
                      <Link className="secondary-action link-btn" to={`/reports?event=${r.eventId}`} onClick={() => select(r.eventId)}>View</Link>
                      {r.status === "draft"
                        ? <button className="secondary-action" onClick={() => onGenerate(r.eventId)}>Generate</button>
                        : <button className="secondary-action" onClick={() => onRegenerate(r.eventId)}>Regenerate</button>}
                      <button className="primary-action" onClick={() => onExport(r.eventId)} disabled={busy !== null} aria-busy={busy === r.eventId}>{busy === r.eventId ? "Preparing…" : "Export PDF"}</button>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="inv-foot">Reports are stored in this browser only. Risk, classification and location are read from the current assessment, so they always match the rest of the application. Regenerating updates the timestamp and sets the status back to Generated.</p>
          </>
        )}
      </Panel>
    </div>
  );
}
