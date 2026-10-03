import type { EventAssessment, EvidenceItem, FactorScore, Observation, RiskLevel } from "@/types";
import type { AlertStatus, PersistenceKey } from "@/types/intelligence";

export type ReportStatus = "draft" | "generated" | "exported";

/** What is persisted per report. Report content is NOT stored: it is rebuilt from the live assessment so it can never drift. */
export interface ReportRecord {
  id: string; // RPT-00421
  eventId: string;
  generatedAt: string; // ISO-8601, last (re)generation or draft save
  status: ReportStatus;
  exportedAt: string | null;
  revision: number; // 1 on first generation, +1 per regeneration
}

export interface ReportField { label: string; value: string; mono?: boolean }

export interface ReportMapPoint { kind: "event" | "facility"; label: string; name: string; x: number; y: number }
export interface ReportMapGeometry {
  points: ReportMapPoint[];
  zones: { x: number; y: number; rKm: number }[];
  /** Local plane in km east (x) / north (y) of the event. */
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  scaleKm: number;
  note: string;
}

export interface ReportFacilityRow {
  label: string; // F1..F3, matches the map markers
  name: string; type: string; km: number; inZone: boolean;
  relatedEvents: number | null; // events attributed to this facility (Facility Intelligence)
  openEvents: number | null;
  facilityRisk: string | null; // current risk status from Facility Intelligence
  facilityPersistence: string | null;
  onMap: boolean;
}

export interface ReportContent {
  reportId: string;
  eventId: string;
  alertId: string | null;
  generatedAt: string;
  revision: number;
  recordStatus: ReportStatus | "unsaved";
  investigationStatus: string; // alert status label
  alertStatus: AlertStatus | null;
  isDemo: boolean;
  sourceLabel: string;
  disclaimer: string | null;
  /** Live reports: the data-source statement (NASA FIRMS observation + OpenStreetMap context + prototype assessment). Null in demo mode. */
  liveNote: string | null;
  /** "NASA FIRMS" / "Demonstration dataset (simulated)". */
  dataSource: string;
  /** "OpenStreetMap" / "OpenStreetMap unavailable" / "Demonstration dataset (fictional names)". */
  industrialSource: string;
  /** Tag for the persistence section: SIMULATED HISTORY or the FIRMS window. */
  historyTag: string;
  overview: ReportField[];
  riskScore: number;
  riskLevel: RiskLevel;
  classification: {
    label: string; group: string; confidence: number; topFit: number;
    runnerUp: { label: string; fit: number } | null;
    isUnknown: boolean; basis: { label: string; score: number }[]; method: string;
  };
  flagged: EvidenceItem[];
  factors: FactorScore[];
  persistence: {
    key: PersistenceKey; label: string; meaning: string;
    /** False when the live FIRMS window is too short to judge persistence. */
    available: boolean;
    total: number; active: number; percent: number; longestStreak: number; currentStreak: number;
    firstActive: string | null; lastActive: string | null;
    trend: string; baseline: number | null;
    history: Observation[]; hasHistory: boolean;
  };
  map: ReportMapGeometry;
  industrial: { nearest: ReportFacilityRow | null; rows: ReportFacilityRow[]; land: string; note: string; emptyNote: string };
  summary: string;
  decision: { level: RiskLevel; headline: string; steps: string[]; caveat: string };
  assessment: EventAssessment;
}
