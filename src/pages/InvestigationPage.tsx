import { Link } from "react-router-dom";
import DataGate from "@/components/common/DataGate";
import Icon from "@/components/common/Icon";
import { useThermalData } from "@/hooks/useThermalData";
import { useSelectedEvent } from "@/hooks/useSelectedEvent";
import { useReportAction } from "@/hooks/useReportBuilder";
import MiniMap from "@/components/Investigation/MiniMap";
import NoEvent from "@/components/Investigation/NoEvent";
import StepNav from "@/components/Investigation/StepNav";
import {
  ClassFits, EventPicker, EvidenceList, FacilityContext, FactorBars, MeasurementGrid, Panel, PersistenceChart, PersistenceSummary,
  RiskBadge, RiskMeter, WEIGHT_NOTE,
} from "@/components/Investigation/parts";
import { CLASS_LABEL } from "@/utils/format";
import { UNKNOWN_THRESHOLD } from "@/services/analysis/engine";
import { DataTag, HistoryTag } from "@/components/common/SourceTag";

function Investigation() {
  const { assessments } = useThermalData();
  const { dataset, event, assessment: a, history, setEvent, unknownEventParam } = useSelectedEvent();
  const report = useReportAction();
  if (!dataset || !event || !a) return <NoEvent unknown={unknownEventParam} />;
  const q = `?event=${event.id}`;
  return (
    <div className="inv">
      <div className="inv-toolbar">
        <EventPicker ds={dataset} value={event.id} onChange={setEvent} assessments={assessments} />
        <div className="inv-toolbar-actions">
          <Link className="secondary-action link-btn" to="/map">← Thermal Map</Link>
          <Link className="secondary-action link-btn" to={`/history${q}`}>History</Link>
          <button className="primary-action" onClick={() => report.open(event.id)}><Icon name="file" size={15} /> {report.has(event.id) ? "VIEW REPORT" : "GENERATE REPORT"}</button>
        </div>
      </div>
      <StepNav />

      <Panel id="sec-assessment" eyebrow={event.source === "firms" ? "AI ASSESSMENT · SOURCE: NASA FIRMS" : "AI ASSESSMENT"} title={`Thermal Event ${event.id}`} aside={<DataTag />} className="scroll-target">
        <div className="assess-grid">
          <MeasurementGrid e={event} a={a} />
          <MiniMap event={event} a={a} />
        </div>
      </Panel>

      <div className="inv-two">
        <Panel id="sec-classification" eyebrow="AI-ASSISTED GEOSPATIAL CLASSIFICATION" title={CLASS_LABEL[a.classification]} className="scroll-target"
          aside={<span className="conf-chip mono">{a.confidence}% confidence</span>}>
          <div className="confidence-track wide"><span style={{ width: `${a.confidence}%` }} /></div>
          {a.classification === "unknown"
            ? <p className="inv-note">No candidate class reached the {Math.round(UNKNOWN_THRESHOLD * 100)}% fit threshold, so the event is labelled Unknown Thermal Anomaly and needs analyst review.</p>
            : <p className="inv-note">Best rule fit {Math.round(a.topFit * 100)}%; next best is {CLASS_LABEL[a.fits[1].cls]} at {Math.round(a.fits[1].fit * 100)}%.</p>}
          <div className="eyebrow sub">CANDIDATE CLASS FIT</div>
          <ClassFits a={a} />
          {a.basis.length > 0 && (<>
            <div className="eyebrow sub">WHY THIS CLASS</div>
            <ul className="basis">{a.basis.map((b) => <li key={b.label}><span>{b.label}</span><span className="mono">{Math.round(b.score * 100)}%</span></li>)}</ul>
          </>)}
          <p className="inv-foot">Confidence is a rule-agreement score (fit, margin over runner-up, sensor confidence). It is not the probability from a trained model.</p>
        </Panel>

        <Panel id="sec-risk" eyebrow="PROTOTYPE RISK SCORE" title="Risk Assessment" className="scroll-target">
          <RiskMeter score={a.riskScore} level={a.riskLevel} />
          <p className="inv-note">The score is calculated from this event's own measurements, history and nearby facility. {WEIGHT_NOTE}</p>
          <p className="inv-foot">Prototype score for triage demonstration. It has not been validated against real incidents.{event.source === "firms" && " It is ThermoGuard's decision-support assessment of a NASA FIRMS thermal anomaly observation, not a statement by NASA and not confirmation of a fire."}</p>
        </Panel>
      </div>

      <div className="inv-two">
        <Panel id="sec-why" eyebrow="EXPLAINABLE EVIDENCE" title="Why This Event Was Flagged" className="scroll-target">
          <EvidenceList a={a} />
          <p className="inv-foot">Only factors at or above 50% are listed.</p>
        </Panel>
        <Panel id="sec-factors" eyebrow="SCORE BREAKDOWN" title="Contributing Factors" className="scroll-target">
          <FactorBars factors={a.factors} />
        </Panel>
      </div>

      <Panel id="sec-persistence" eyebrow="HISTORICAL OBSERVATIONS" title={a.persistence.available ? `Persistence Analysis · ${a.persistence.total}-day window` : "Persistence Analysis · history unavailable"} className="scroll-target"
        aside={<HistoryTag />}>
        <PersistenceSummary a={a} />
        {a.persistence.available && <PersistenceChart obs={history} baseline={a.persistence.baselineFrpMw} />}
        {event.source === "firms" && <p className="inv-foot">History comes only from the NASA FIRMS observation window that was fetched; a day without a detection can mean no heat or no usable overpass (for example cloud cover). Nothing is simulated.</p>}
      </Panel>

      <Panel id="sec-context" eyebrow="NEARBY INDUSTRIAL CONTEXT" title="Nearest Facility" className="scroll-target"
        aside={a.nearest && <span className="mono ctx-dist">{a.nearest.km.toFixed(2)} km</span>}>
        <FacilityContext a={a} />
      </Panel>

      <Panel id="sec-report" eyebrow="NEXT STEP" title="Investigation Report" className="scroll-target">
        <div className="report-cta">
          <div><RiskBadge level={a.riskLevel} /> <span className="inv-note inline">Compile this assessment into an investigation report you can review and export as a PDF.</span></div>
          <button className="primary-action" onClick={() => report.open(event.id)}><Icon name="file" size={15} /> {report.has(event.id) ? "VIEW REPORT" : "GENERATE REPORT"}</button>
        </div>
      </Panel>
    </div>
  );
}

export default function InvestigationPage() {
  return <DataGate><Investigation /></DataGate>;
}
