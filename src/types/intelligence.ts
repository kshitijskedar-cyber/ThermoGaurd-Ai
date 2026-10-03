import type { Classification, EventAssessment, Facility, RiskLevel, ThermalEvent } from "@/types";

/** Persistence label derived from the share of observation days with a detection. */
export type PersistenceKey = "persistent" | "intermittent" | "isolated" | "unavailable";
export interface PersistenceStatus { key: PersistenceKey; label: string; active: number; total: number; ratio: number; percent: number; /** False in live mode when the FIRMS window is too short to judge persistence. */ available: boolean }

/* ---------- Alerts ---------- */
export type AlertStatus = "new" | "investigating" | "resolved";
export type AlertPriority = "critical" | "high" | "monitoring" | "informational";

export interface Alert {
  id: string; // AL-00421
  eventId: string;
  timestamp: string; // ISO-8601 UTC: detection time of the underlying event
  region: string;
  lat: number;
  lon: number;
  riskScore: number;
  riskLevel: RiskLevel;
  priority: AlertPriority;
  priorityLabel: string;
  classification: Classification;
  confidence: number;
  nearest: { facilityId: string; name: string; type: string; km: number } | null;
  persistence: PersistenceStatus;
  /** Status the demo dataset starts with, before any analyst action. */
  baseStatus: AlertStatus;
  /** Effective status (analyst override applied). */
  status: AlertStatus;
}

export interface AlertStatusChange { from: AlertStatus; to: AlertStatus; at: string }
export interface AlertOverride { status: AlertStatus; log: AlertStatusChange[] }
export type AlertOverrides = Record<string, AlertOverride>; // keyed by event id

export interface AlertSummary { active: number; critical: number; high: number; investigating: number; resolved: number; total: number }

/* ---------- Facilities ---------- */
export type FacilityRiskStatus = RiskLevel | "normal";
export type FacilityPersistenceKey = "persistent" | "recurring" | "isolated" | "none" | "unavailable";

export interface FacilityEvent {
  event: ThermalEvent;
  assessment: EventAssessment;
  km: number;
  persistence: PersistenceStatus;
  /** True while the matching alert is not resolved. */
  open: boolean;
}

export interface FacilityStats {
  facility: Facility;
  events: FacilityEvent[]; // newest first
  total: number;
  byRisk: Record<RiskLevel, number>;
  openCount: number;
  persistentCount: number;
  highest: { eventId: string; level: RiskLevel; score: number } | null;
  /** Highest risk among events whose alert is still open. "normal" when none are open. */
  riskStatus: FacilityRiskStatus;
  persistence: FacilityPersistenceKey;
  persistenceLabel: string;
  lastEvent: ThermalEvent | null;
  meanPersistencePercent: number;
  longestStreak: number;
}

/* ---------- Analytics ---------- */
export interface TimelinePoint { date: string; label: string; all: number; urgent: number }
export interface TimelineResult { days: number; points: TimelinePoint[]; total: number; mean: number; peak: TimelinePoint | null }

export interface Insight { key: string; text: string; to?: string; tone: "red" | "orange" | "amber" | "blue" | "green" }
