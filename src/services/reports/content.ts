import type { EventAssessment, RiskLevel, ThermalDataset, ThermalEvent } from "@/types";
import type { Alert, FacilityStats, PersistenceKey } from "@/types/intelligence";
import type { ReportContent, ReportFacilityRow, ReportRecord } from "@/types/reports";
import { CLASS_LABEL, RISK_LABEL, formatIST, formatSensorConfidence } from "@/utils/format";
import { EVIDENCE_THRESHOLD, MIN_HISTORY_DAYS, UNKNOWN_THRESHOLD } from "@/services/analysis/engine";
import { persistenceStatus } from "@/services/intelligence/persistence";
import { CLASS_GROUPS } from "@/services/intelligence/analytics";
import { STATUS_LABEL } from "@/services/intelligence/alerts";
import { ZONE_KM } from "@/services/intelligence/facilities";
import { buildMapGeometry } from "./mapGeometry";

export const DEMO_DISCLAIMER = "DEMONSTRATION DATA — NOT LIVE INCIDENT DATA";
export const DEMO_DISCLAIMER_LONG =
  "All thermal events, facilities and observation history in this report are simulated demonstration data. This is not a live NASA FIRMS detection, not real-time satellite observation and not a record of a real incident or emergency.";
/** Required wording for reports built from live NASA FIRMS observations. */
export const LIVE_REPORT_NOTE =
  "Assessment based on NASA FIRMS thermal anomaly observations and available OpenStreetMap geospatial context. This report is a prototype decision-support assessment and does not constitute independent confirmation of a fire.";
export const LIVE_BANNER_TITLE = "LIVE NASA FIRMS DATA · PROTOTYPE ASSESSMENT";
export const METHOD_NOTE =
  "AI-Assisted Geospatial Classification: the prototype combines thermal measurements (FRP, brightness temperature) with geospatial features (distance to facilities, land-use context) and observation history using transparent, rule-based analytical logic. It is not a trained machine-learning or deep-learning model, and its outputs have not been validated against real incidents. Confidence is a rule-agreement score, not a model probability.";

/** Report ID derives from the event ID (TG-2026-00421 -> RPT-00421), the same way alert IDs do, so it is stable and reversible. */
export const reportIdFor = (eventId: string) => (/^(TG-\d{4}|FIRMS)-/.test(eventId) ? eventId.replace(/^(TG-\d{4}|FIRMS)-/, "RPT-") : `RPT-${eventId}`);

export const REPORT_STATUS_LABEL = { draft: "DRAFT", generated: "GENERATED", exported: "EXPORTED" } as const;

const PERSISTENCE_MEANING: Record<PersistenceKey, string> = {
  persistent: "Persistent activity: detections on at least 6 of 10 observation days.",
  intermittent: "Intermittent activity: detections on 3 to 5 of 10 observation days.",
  isolated: "No persistent activity: detections on fewer than 3 of 10 observation days.",
  unavailable: "Historical persistence unavailable.",
};
const PERSISTENCE_MEANING_LIVE: Record<PersistenceKey, string> = {
  persistent: "Persistent activity: detections on at least 60% of the days in the NASA FIRMS window.",
  intermittent: "Intermittent activity: detections on 30% to 59% of the days in the NASA FIRMS window.",
  isolated: "No persistent activity: detections on fewer than 30% of the days in the NASA FIRMS window.",
  unavailable: `Historical persistence unavailable for this live observation: the NASA FIRMS window holds fewer than ${MIN_HISTORY_DAYS} observation days for this location. No history is simulated.`,
};

const DECISION: Record<RiskLevel, { headline: string; steps: string[] }> = {
  low: {
    headline: "Continue monitoring.",
    steps: ["Keep the event in routine monitoring.", "Re-assess if persistence or thermal intensity increases in later observations."],
  },
  moderate: {
    headline: "Monitor and review surrounding activity.",
    steps: ["Review other thermal events and facilities in the surrounding area.", "Re-assess at the next observation and compare with the persistence history."],
  },
  high: {
    headline: "Prioritize investigation and review nearby industrial activity.",
    steps: ["Prioritize this event for analyst investigation.", "Review activity at the nearby industrial facilities listed in this report.", "Seek independent verification before any conclusion is drawn."],
  },
  critical: {
    headline: "Prioritize immediate investigation and verification.",
    steps: ["Place this event at the top of the investigation queue.", "Verify the detection and the nearby industrial context through independent sources.", "Review the persistence history to separate a new spike from known steady heat."],
  },
};

const joinList = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
export const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;
const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const dayLabel = (iso: string) => formatIST(iso).split(",")[0];

function trendText(a: EventAssessment): string {
  const r = a.persistence.frpRatio, b = a.persistence.baselineFrpMw;
  if (r == null || b == null) return "Not enough earlier detections (fewer than 2) to compare against a baseline.";
  const x = `${r.toFixed(2)}x the ${b.toFixed(1)} MW mean of earlier detections`;
  return r >= 1.15 ? `Current FRP is above the historical baseline: ${x}.` : r <= 0.85 ? `Current FRP is below the historical baseline: ${x}.` : `Current FRP is in line with the historical baseline: ${x}.`;
}

function facilityRow(label: string, f: { facility: { id: string; name: string; type: string }; km: number }, stats: FacilityStats[], onMap: boolean): ReportFacilityRow {
  const s = stats.find((x) => x.facility.id === f.facility.id);
  return {
    label, name: f.facility.name, type: f.facility.type, km: f.km, inZone: f.km <= ZONE_KM, onMap,
    relatedEvents: s ? s.total : null, openEvents: s ? s.openCount : null,
    facilityRisk: s ? (s.riskStatus === "normal" ? "NORMAL" : RISK_LABEL[s.riskStatus]) : null,
    facilityPersistence: s ? s.persistenceLabel : null,
  };
}

export interface BuildInput {
  dataset: ThermalDataset;
  event: ThermalEvent;
  assessment: EventAssessment;
  alert: Alert | undefined;
  facilityStats: FacilityStats[];
  record: ReportRecord | undefined;
  /** Used for the timestamp of an unsaved preview. */
  now?: string;
}

/**
 * Pure. Assembles a report from values the application already computed (Phase 2 assessment, Phase 3A alert and facility
 * statistics). Nothing here recalculates risk, classification or persistence.
 */
export function buildReportContent({ dataset, event: e, assessment: a, alert, facilityStats, record, now }: BuildInput): ReportContent {
  const isDemo = dataset.mode === "demo";
  const osmOk = dataset.sources?.facilities === "OpenStreetMap";
  const dataSource = isDemo ? "Demonstration dataset (simulated)" : "NASA FIRMS";
  const industrialSource = isDemo ? "Demonstration dataset (fictional names)" : osmOk ? "OpenStreetMap" : "OpenStreetMap unavailable";
  const histOk = a.persistence.available;
  const ps = persistenceStatus(a.persistence);
  const group = CLASS_GROUPS.find((g) => g.classes.includes(a.classification))?.label ?? CLASS_LABEL[a.classification];
  const history = dataset.history[e.id] ?? [];
  const actives = history.filter((o) => o.active);
  const hasHistory = history.length > 0 && histOk;
  const map = buildMapGeometry(e, a.neighbours);
  const plotted = new Set(map.points.filter((p) => p.kind === "facility").map((p) => p.name));
  const rows = a.neighbours.map((n, i) => facilityRow(`F${i + 1}`, n, facilityStats, plotted.has(n.facility.name)));
  const nearest = rows[0] ?? null;
  const runner = a.classification !== "unknown" && a.fits[1] ? { label: CLASS_LABEL[a.fits[1].cls], fit: Math.round(a.fits[1].fit * 100) } : null;

  const influenced = a.evidence.length
    ? joinList(a.evidence.map((x) => lc(x.text)))
    : `no single factor at or above the ${Math.round(EVIDENCE_THRESHOLD * 100)}% evidence threshold`;
  const proximity = a.nearest
    ? `${a.nearest.km <= ZONE_KM ? "inside" : "outside"} the ${ZONE_KM} km zone of ${a.nearest.facility.name} (${a.nearest.km.toFixed(2)} km away)`
    : isDemo ? "with no industrial facility in the loaded dataset" : osmOk ? "with no mapped OpenStreetMap industrial object nearby" : "with OpenStreetMap context unavailable";
  const persistLine = hasHistory
    ? `${lc(ps.label)} thermal activity, with detections on ${ps.active} of ${ps.total} observation days (${ps.percent}%)`
    : histOk ? "no observation history available for persistence analysis" : "historical persistence unavailable for this live observation";
  const summary = (isDemo ? "" : "This thermal anomaly was observed by NASA FIRMS and assessed by ThermoGuard. ") +
    `This detected anomaly was classified as ${CLASS_LABEL[a.classification]} (${group}) with a prototype risk score of ${a.riskScore}/100 (${RISK_LABEL[a.riskLevel]}). ` +
    `The assessment was influenced by ${influenced}. The event was detected ${proximity} and shows ${persistLine}. ` +
    `This is a prototype assessment${isDemo ? " on demonstration data" : " based on NASA FIRMS thermal anomaly observations and available OpenStreetMap context"}; it does not confirm that a fire or incident has occurred.`;

  const d = DECISION[a.riskLevel];
  return {
    reportId: record?.id ?? reportIdFor(e.id), eventId: e.id, alertId: alert?.id ?? null,
    generatedAt: record?.generatedAt ?? now ?? new Date().toISOString(), revision: record?.revision ?? 0,
    recordStatus: record?.status ?? "unsaved",
    investigationStatus: alert ? STATUS_LABEL[alert.status] : "NOT TRIAGED", alertStatus: alert?.status ?? null,
    isDemo, sourceLabel: dataset.sourceLabel, disclaimer: isDemo ? DEMO_DISCLAIMER : null,
    liveNote: isDemo ? null : LIVE_REPORT_NOTE, dataSource, industrialSource,
    historyTag: isDemo ? "SIMULATED HISTORY" : `FIRMS WINDOW · ${dataset.historyWindowDays ?? 5} DAYS`,
    overview: [
      { label: "Data source", value: dataSource },
      { label: "Industrial context", value: industrialSource },
      { label: "Event ID", value: e.id, mono: true },
      { label: "Detection time", value: formatIST(e.detectedAt), mono: true },
      { label: "Latitude", value: `${e.lat.toFixed(4)}° ${e.lat >= 0 ? "N" : "S"}`, mono: true },
      { label: "Longitude", value: `${e.lon.toFixed(4)}° ${e.lon >= 0 ? "E" : "W"}`, mono: true },
      { label: "Location", value: e.region },
      { label: "Sensor", value: `${e.instrument} / ${e.satellite}` },
      { label: "Thermal intensity (FRP)", value: `${e.frpMw} MW`, mono: true },
      { label: "Brightness temperature", value: `${e.brightnessK} K`, mono: true },
      { label: "Sensor detection confidence", value: formatSensorConfidence(e), mono: true },
      { label: "Classification", value: CLASS_LABEL[a.classification] },
      { label: "Classification confidence", value: `${a.confidence}% (rule agreement)`, mono: true },
      { label: "Prototype risk score", value: `${a.riskScore} / 100 · ${RISK_LABEL[a.riskLevel]}`, mono: true },
    ],
    riskScore: a.riskScore, riskLevel: a.riskLevel,
    classification: {
      label: CLASS_LABEL[a.classification], group, confidence: a.confidence, topFit: Math.round(a.topFit * 100), runnerUp: runner,
      isUnknown: a.classification === "unknown", basis: a.basis.map((b) => ({ label: b.label, score: Math.round(b.score * 100) })),
      method: a.classification === "unknown"
        ? `No candidate class reached the ${Math.round(UNKNOWN_THRESHOLD * 100)}% rule-fit threshold, so the event is labelled Unknown Thermal Anomaly and needs analyst review.`
        : `Best rule fit ${Math.round(a.topFit * 100)}%${runner ? `; next best is ${runner.label} at ${runner.fit}%` : ""}.`,
    },
    flagged: a.evidence, factors: a.factors,
    persistence: {
      key: ps.key, label: ps.label, meaning: (isDemo ? PERSISTENCE_MEANING : PERSISTENCE_MEANING_LIVE)[ps.key], available: histOk, total: ps.total, active: ps.active, percent: ps.percent,
      longestStreak: a.persistence.longestStreak, currentStreak: a.persistence.currentStreak,
      firstActive: actives[0] ? dayLabel(actives[0].date) : null, lastActive: actives.length ? dayLabel(actives[actives.length - 1].date) : null,
      trend: trendText(a), baseline: a.persistence.baselineFrpMw, history, hasHistory,
    },
    map,
    industrial: {
      nearest, rows, land: a.land.label,
      note: isDemo
        ? "Facilities come from the demonstration dataset (fictional names). Operating status is not part of the dataset, so zone membership is shown instead."
        : "Facilities are OpenStreetMap objects (volunteer-mapped, uneven coverage); an OSM object is not confirmation of an operating facility. Operating status is not available, so zone membership is shown instead.",
      emptyNote: isDemo ? "No industrial facility exists in the loaded dataset, so no facility context is available for this event."
        : osmOk ? "No industrial object mapped in OpenStreetMap was found near this event. OSM coverage is uneven, so this does not prove that no facility exists."
        : "OpenStreetMap context could not be loaded, so no facility context is available for this event.",
    },
    summary,
    decision: { level: a.riskLevel, headline: d.headline, steps: d.steps, caveat: "Prototype decision support only. These are not emergency instructions and do not confirm a real-world incident." },
    assessment: a,
  };
}
