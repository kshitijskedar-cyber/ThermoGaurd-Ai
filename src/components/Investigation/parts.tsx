import type { ReactNode } from "react";
import type { Classification, EventAssessment, FactorScore, Observation, ThermalDataset, ThermalEvent } from "@/types";
import Icon from "@/components/common/Icon";
import { CLASS_LABEL, RISK_BANDS, RISK_LABEL, formatDay, formatIST, formatSensorConfidence } from "@/utils/format";
import { useThermalData } from "@/hooks/useThermalData";
import { RISK_WEIGHTS, UNKNOWN_THRESHOLD } from "@/services/analysis/engine";

export function Panel({ id, eyebrow, title, aside, children, className = "" }: { id?: string; eyebrow?: string; title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`inv-panel ${className}`}>
      <header className="inv-panel-head">
        <div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h2 className="inv-panel-title">{title}</h2></div>
        {aside}
      </header>
      <div className="inv-panel-body">{children}</div>
    </section>
  );
}

export function EventPicker({ ds, value, onChange, assessments }: { ds: ThermalDataset; value: string; onChange: (id: string) => void; assessments: Record<string, EventAssessment> }) {
  const rows = [...ds.events].sort((a, b) => (assessments[b.id]?.riskScore ?? 0) - (assessments[a.id]?.riskScore ?? 0));
  return (
    <label className="inv-picker">
      <span className="eyebrow">THERMAL EVENT</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Select thermal event">
        {rows.map((e) => <option key={e.id} value={e.id}>{e.id} · {CLASS_LABEL[e.classification]} · score {assessments[e.id]?.riskScore ?? "–"}</option>)}
      </select>
    </label>
  );
}

export function RiskBadge({ level }: { level: EventAssessment["riskLevel"] }) {
  return <span className={`risk-badge ${level}`}>{RISK_LABEL[level]}</span>;
}

export function RiskMeter({ score, level }: { score: number; level: EventAssessment["riskLevel"] }) {
  return (
    <div className="risk-meter">
      <div className="risk-meter-top">
        <div className="risk-score"><span className={`risk-num ${level}`}>{score}</span><span className="risk-of">/ 100</span></div>
        <RiskBadge level={level} />
      </div>
      <div className="risk-scale" role="img" aria-label={`Risk score ${score} of 100, ${RISK_LABEL[level]}`}>
        {RISK_BANDS.map((b) => <span key={b.level} className={`band ${b.level}`} style={{ flexGrow: b.max - b.min + 1 }} />)}
        <i className="risk-marker" style={{ left: `${Math.min(score, 100)}%` }} />
      </div>
      <div className="risk-bands">
        {RISK_BANDS.map((b) => <span key={b.level} className={b.level === level ? "on" : ""} style={{ flexGrow: b.max - b.min + 1 }}><b>{b.label}</b><small>{b.range}</small></span>)}
      </div>
    </div>
  );
}

export function FactorBars({ factors, showDetail = true }: { factors: FactorScore[]; showDetail?: boolean }) {
  return (
    <div className="factor-list">
      {factors.map((f) => (
        <div key={f.key} className="factor">
          <div className="factor-head"><span>{f.label}</span><strong className="mono">{Math.round(f.value * 100)}%</strong></div>
          <div className="factor-track"><span style={{ width: `${Math.round(f.value * 100)}%` }} className={f.value >= 0.5 ? "strong" : ""} /></div>
          <div className="factor-meta"><span>Weight {Math.round(f.weight * 100)}%</span><span className="mono">+{f.points.toFixed(1)} pts</span></div>
          {showDetail && <div className="factor-detail">{f.detail}</div>}
        </div>
      ))}
      <div className="factor-total"><span>Prototype Risk Score = Σ (factor × weight)</span><strong className="mono">{factors.reduce((a, f) => a + f.points, 0).toFixed(1)}</strong></div>
    </div>
  );
}

export function EvidenceList({ a }: { a: EventAssessment }) {
  if (!a.evidence.length)
    return <p className="inv-note">No individual factor reached the {Math.round(0.5 * 100)}% evidence threshold, so no supporting evidence is listed for this event.</p>;
  return (
    <ul className="evidence">
      {a.evidence.map((e) => (
        <li key={e.key}><span className="check" aria-hidden="true"><Icon name="shield" size={15} /></span><div><strong>{e.text}</strong><small>{e.detail}</small></div></li>
      ))}
    </ul>
  );
}

export function ClassFits({ a }: { a: EventAssessment }) {
  const winner = a.classification;
  return (
    <div className="fit-list">
      {a.fits.map((f) => (
        <div key={f.cls} className={`fit ${f.cls === winner ? "winner" : ""}`}>
          <span className="fit-name">{CLASS_LABEL[f.cls as Classification]}</span>
          <span className="fit-track"><span style={{ width: `${Math.round(f.fit * 100)}%` }} /></span>
          <span className="mono fit-val">{Math.round(f.fit * 100)}%</span>
        </div>
      ))}
      <div className={`fit unk ${winner === "unknown" ? "winner" : ""}`}>
        <span className="fit-name">{CLASS_LABEL.unknown}</span><span className="fit-rule">assigned when no class reaches {Math.round(UNKNOWN_THRESHOLD * 100)}%</span>
      </div>
    </div>
  );
}

export function PersistenceChart({ obs, baseline }: { obs: Observation[]; baseline: number | null }) {
  const max = Math.max(1, ...obs.map((o) => o.frpMw ?? 0), baseline ?? 0) * 1.08;
  return (
    <div className="pchart" style={{ ["--n" as string]: obs.length }}>
      <div className="pchart-bars">
        {baseline != null && <div className="pchart-baseline" style={{ bottom: `${(baseline / max) * 100}%` }}><span>prior mean {baseline.toFixed(1)} MW</span></div>}
        {obs.map((o) => (
          <div key={o.day} className="pcol" title={o.active ? `${formatDay(o.date)}: ${o.frpMw} MW` : `${formatDay(o.date)}: no detection`}>
            {o.active ? <span className="pbar" style={{ height: `${((o.frpMw ?? 0) / max) * 100}%` }}><em>{Math.round(o.frpMw ?? 0)}</em></span> : <span className="pbar none" />}
          </div>
        ))}
      </div>
      <div className="pchart-dots">
        {obs.map((o) => <div key={o.day} className={`pdot ${o.active ? "on" : "off"}`} aria-label={`Day ${o.day} ${o.active ? "active" : "no detection"}`}>{o.active ? "●" : "—"}</div>)}
      </div>
      <div className="pchart-days">
        {obs.map((o) => <div key={o.day}><b>D{o.day}</b><small>{formatDay(o.date)}</small></div>)}
      </div>
      <div className="pchart-legend"><span><i className="sw on" />Detection (bar = FRP, MW)</span><span><i className="sw off" />No detection</span>{baseline != null && <span><i className="sw base" />Mean FRP of earlier detections</span>}</div>
    </div>
  );
}

export function PersistenceSummary({ a }: { a: EventAssessment }) {
  const p = a.persistence;
  if (!p.available)
    return <p className="inv-note warn">Historical persistence unavailable for this live observation: the NASA FIRMS window holds only {p.total} observation {p.total === 1 ? "day" : "days"} for this location, too few to judge repeated activity. No history is simulated.</p>;
  return (
    <div className="pstats">
      <div><small>TOTAL OBSERVATIONS</small><strong className="mono">{p.total}</strong></div>
      <div><small>ACTIVE OBSERVATIONS</small><strong className="mono">{p.active}</strong></div>
      <div><small>PERSISTENCE</small><strong className="mono">{p.percent}%</strong></div>
      <div><small>CURRENT STREAK</small><strong className="mono">{p.currentStreak} d</strong></div>
    </div>
  );
}

export function FacilityContext({ a }: { a: EventAssessment }) {
  const { dataset } = useThermalData();
  const n = a.nearest;
  const ev = dataset?.events.find((x) => x.id === a.eventId);
  const live = ev?.source === "firms";
  if (!n) {
    if (live && dataset?.live?.facilitiesOk === false) return <p className="inv-note warn">OpenStreetMap context could not be loaded, so nearby industrial facilities are unavailable for this event. This is not evidence that none exist.</p>;
    if (live && ev?.osmCovered === false) return <p className="inv-note warn">This location was outside the area queried in OpenStreetMap (query limit), so industrial context is unavailable for this event.</p>;
    return <p className="inv-note">{live ? "No industrial object mapped in OpenStreetMap was found near this event. OSM coverage is uneven, so this does not prove that no facility exists." : "No facility exists in the loaded dataset."}</p>;
  }
  const inZone = n.km <= 1;
  return (
    <div className="ctx">
      <dl className="kv">
        <div><dt>Nearest facility</dt><dd>{n.facility.name}</dd></div>
        <div><dt>Facility type</dt><dd>{n.facility.type}</dd></div>
        <div><dt>Distance</dt><dd className="mono">{n.km.toFixed(2)} km</dd></div>
        <div><dt>Facility status</dt><dd>{inZone ? "Event inside 1 km facility zone" : "Event outside 1 km facility zone"}</dd></div>
        {n.facility.source === "osm" && <div><dt>Source</dt><dd>OpenStreetMap · <span className="mono">{n.facility.osmRef}</span></dd></div>}
        {n.facility.source === "osm" && n.facility.osmBasis && <div><dt>Type based on</dt><dd className="mono">{n.facility.osmBasis}</dd></div>}
        <div><dt>Land-use context</dt><dd>{a.land.label}</dd></div>
        <div><dt>Region</dt><dd>{n.facility.region}</dd></div>
      </dl>
      <p className="inv-note">{n.facility.source === "osm"
        ? "Facility context from OpenStreetMap (volunteer-mapped, coverage is uneven). An OSM object is not confirmation of an operating facility, and its operating status is not available, so zone membership is shown instead."
        : "Facility from the demonstration dataset (fictional name). Its operating status is not part of the dataset, so zone membership is shown instead."}</p>
      <div className="eyebrow ctx-sub">NEAREST FACILITIES</div>
      <table className="mini-table"><tbody>
        {a.neighbours.map((x) => <tr key={x.facility.id}><td>{x.facility.name}</td><td>{x.facility.type}</td><td className="mono">{x.km.toFixed(1)} km</td></tr>)}
      </tbody></table>
    </div>
  );
}

export function MeasurementGrid({ e, a }: { e: ThermalEvent; a: EventAssessment }) {
  return (
    <dl className="kv">
      <div><dt>Event ID</dt><dd className="mono">{e.id}</dd></div>
      <div><dt>Classification</dt><dd>{CLASS_LABEL[a.classification]}</dd></div>
      <div><dt>AI confidence</dt><dd className="mono">{a.confidence}%</dd></div>
      {e.source === "firms" && <div><dt>Source</dt><dd>NASA FIRMS thermal anomaly</dd></div>}
      {e.source === "firms" && <div><dt>Sensor confidence</dt><dd className="mono">{formatSensorConfidence(e)}</dd></div>}
      {e.source === "firms" && <div><dt>Sensor</dt><dd>{e.instrument} / {e.satellite}</dd></div>}
      <div><dt>Prototype Risk Score</dt><dd className="mono">{a.riskScore} / 100</dd></div>
      <div><dt>Risk level</dt><dd><RiskBadge level={a.riskLevel} /></dd></div>
      <div><dt>FRP</dt><dd className="mono">{e.frpMw} MW</dd></div>
      <div><dt>Brightness temperature</dt><dd className="mono">{e.brightnessK} K</dd></div>
      <div><dt>Coordinates</dt><dd className="mono">{e.lat.toFixed(4)}°, {e.lon.toFixed(4)}°</dd></div>
      <div><dt>Timestamp</dt><dd className="mono">{formatIST(e.detectedAt)}</dd></div>
      <div><dt>Persistence</dt><dd className="mono">{a.persistence.available ? `${a.persistence.active} / ${a.persistence.total} days (${a.persistence.percent}%)` : "Unavailable (short FIRMS window)"}</dd></div>
      <div><dt>Nearby facility</dt><dd>{a.nearest ? a.nearest.facility.name : "—"}</dd></div>
      <div><dt>Distance to facility</dt><dd className="mono">{a.nearest ? `${a.nearest.km.toFixed(2)} km` : "—"}</dd></div>
    </dl>
  );
}

export const WEIGHT_NOTE = `Weights: thermal ${RISK_WEIGHTS.thermal * 100}%, proximity ${RISK_WEIGHTS.proximity * 100}%, persistence ${RISK_WEIGHTS.persistence * 100}%, historical anomaly ${RISK_WEIGHTS.abnormality * 100}%.`;
