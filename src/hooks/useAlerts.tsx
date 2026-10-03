import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Alert, AlertOverrides, AlertStatus, AlertSummary } from "@/types/intelligence";
import { applyOverrides, generateAlerts, STATUS_ORDER, summariseAlerts } from "@/services/intelligence/alerts";
import { useThermalData } from "./useThermalData";

const STORAGE_KEY = "thermoguard.alert-status.v1";

interface Ctx {
  alerts: Alert[];
  summary: AlertSummary;
  overrides: AlertOverrides;
  /** Alert for an event id, or undefined. */
  forEvent: (eventId: string) => Alert | undefined;
  byId: (alertId: string) => Alert | undefined;
  /** Event ids whose alert is not resolved. */
  openEventIds: Set<string>;
  setStatus: (eventId: string, status: AlertStatus) => void;
  resetStatuses: () => void;
}
const AlertCtx = createContext<Ctx | null>(null);

/** Reads saved analyst actions; anything malformed is discarded so a bad value can never break the app. */
function loadOverrides(): AlertOverrides {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: AlertOverrides = {};
    for (const [id, v] of Object.entries(parsed as Record<string, unknown>)) {
      const o = v as { status?: unknown; log?: unknown };
      if (!STATUS_ORDER.includes(o?.status as AlertStatus)) continue;
      const log = Array.isArray(o.log) ? o.log.filter((l: { from?: unknown; to?: unknown; at?: unknown }) => STATUS_ORDER.includes(l?.from as AlertStatus) && STATUS_ORDER.includes(l?.to as AlertStatus) && typeof l?.at === "string") : [];
      out[id] = { status: o.status as AlertStatus, log: log as AlertOverrides[string]["log"] };
    }
    return out;
  } catch { return {}; }
}

export function AlertProvider({ children }: { children: ReactNode }) {
  const { dataset, assessments } = useThermalData();
  const [overrides, setOverrides] = useState<AlertOverrides>(loadOverrides);

  useEffect(() => {
    try {
      if (Object.keys(overrides).length) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch { /* storage unavailable (private mode, quota): statuses simply last for this session */ }
  }, [overrides]);

  const base = useMemo(() => (dataset ? generateAlerts(dataset, assessments) : []), [dataset, assessments]);
  const alerts = useMemo(() => applyOverrides(base, overrides), [base, overrides]);
  const summary = useMemo(() => summariseAlerts(alerts), [alerts]);
  const openEventIds = useMemo(() => new Set(alerts.filter((a) => a.status !== "resolved").map((a) => a.eventId)), [alerts]);

  const setStatus = useCallback((eventId: string, status: AlertStatus) => {
    const current = base.find((a) => a.eventId === eventId);
    if (!current) return;
    setOverrides((prev) => {
      const from = prev[eventId]?.status ?? current.baseStatus;
      if (from === status) return prev;
      const log = [...(prev[eventId]?.log ?? []), { from, to: status, at: new Date().toISOString() }];
      // The override is kept even when the analyst returns to the dataset's own status, so the audit trail stays complete.
      return { ...prev, [eventId]: { status, log } };
    });
  }, [base]);

  const resetStatuses = useCallback(() => setOverrides({}), []);
  const forEvent = useCallback((eventId: string) => alerts.find((a) => a.eventId === eventId), [alerts]);
  const byId = useCallback((alertId: string) => alerts.find((a) => a.id === alertId), [alerts]);

  const value = useMemo(() => ({ alerts, summary, overrides, forEvent, byId, openEventIds, setStatus, resetStatuses }),
    [alerts, summary, overrides, forEvent, byId, openEventIds, setStatus, resetStatuses]);
  return <AlertCtx.Provider value={value}>{children}</AlertCtx.Provider>;
}

export function useAlerts(): Ctx {
  const c = useContext(AlertCtx);
  if (!c) throw new Error("useAlerts must be used inside AlertProvider");
  return c;
}
