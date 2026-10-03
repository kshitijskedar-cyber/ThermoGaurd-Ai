import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon from "@/components/common/Icon";
import NoEvent from "@/components/Investigation/NoEvent";
import { EventPicker } from "@/components/Investigation/parts";
import StateBlock from "@/components/common/StateBlock";
import { useReports } from "@/hooks/useReports";
import { useReportBuilder, useReportExport } from "@/hooks/useReportBuilder";
import { useSelectedEvent } from "@/hooks/useSelectedEvent";
import { useThermalData } from "@/hooks/useThermalData";
import { formatIST } from "@/utils/format";
import ReportDocument from "./ReportDocument";

export default function ReportPreview() {
  const { assessments } = useThermalData();
  const { dataset, event, assessment, unknownEventParam } = useSelectedEvent();
  const navigate = useNavigate();
  const build = useReportBuilder();
  const exportPdf = useReportExport();
  const { forEvent, generate, saveDraft } = useReports();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (!dataset || !event || !assessment) return <NoEvent unknown={unknownEventParam} />;
  const record = forEvent(event.id);
  const content = build(event.id);
  if (!content)
    return <StateBlock variant="error" title="This report could not be prepared" detail="The event's analysis is not available. Return to AI Investigation and try again." />;

  const q = `?event=${event.id}`;
  const isDraftOrNone = !record || record.status === "draft";
  const onExport = async () => {
    setBusy(true); setError(null); setDone(null);
    try { await exportPdf(event.id); setDone("PDF exported. The report status is now Exported."); }
    catch (e) { setError(e instanceof Error ? e.message : "Unknown error"); }
    finally { setBusy(false); }
  };

  return (
    <div className="inv rpt-page">
      <div className="inv-toolbar no-print">
        <EventPicker ds={dataset} value={event.id} onChange={(id) => navigate(`/reports?event=${id}`, { replace: true })} assessments={assessments} />
        <div className="inv-toolbar-actions">
          <Link className="secondary-action link-btn" to="/reports">All reports</Link>
          <Link className="secondary-action link-btn" to={`/investigation${q}`}>← Investigation</Link>
        </div>
      </div>

      <div className="rpt-bar no-print" role="region" aria-label="Report actions">
        <div className="rpt-bar-state">
          {record
            ? <><span className={`chip rstatus-${record.status}`}>{record.status.toUpperCase()}</span><span>{record.status === "draft" ? "Draft saved" : `Generated ${formatIST(record.generatedAt)} · revision ${record.revision}`}{record.exportedAt ? ` · exported ${formatIST(record.exportedAt)}` : ""}</span></>
            : <><span className="chip rstatus-unsaved">PREVIEW</span><span>Not generated yet. This preview is built from the current assessment and is not saved.</span></>}
        </div>
        <div className="rpt-bar-actions">
          {!record && <button className="secondary-action" onClick={() => saveDraft(event.id)}>Save draft</button>}
          {isDraftOrNone
            ? <button className="secondary-action" onClick={() => generate(event.id)}><Icon name="file" size={14} /> Generate report</button>
            : <button className="secondary-action" onClick={() => { generate(event.id); setDone("Report regenerated from the current assessment."); setError(null); }}>Regenerate</button>}
          <button className="primary-action" onClick={onExport} disabled={busy} aria-busy={busy}><Icon name="file" size={14} /> {busy ? "Preparing PDF…" : "Export PDF"}</button>
        </div>
      </div>
      {error && <div className="rh-error no-print" role="alert"><strong>PDF export failed.</strong> {error} <button className="plain-button" onClick={onExport}>Try again</button></div>}
      {done && !error && <p className="rh-notice no-print" role="status">{done}</p>}

      <ReportDocument c={content} event={event} />
    </div>
  );
}
