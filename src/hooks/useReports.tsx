import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ReportRecord, ReportStatus } from "@/types/reports";
import { reportIdFor } from "@/services/reports/content";
import { useThermalData } from "./useThermalData";

const STORAGE_KEY = "thermoguard.reports.v1";
const STATUSES: ReportStatus[] = ["draft", "generated", "exported"];
type Store = Record<string, ReportRecord>; // keyed by event id: one report per event, regenerated in place

interface Ctx {
  /** Report records for events that exist in the loaded dataset, newest first. */
  records: ReportRecord[];
  forEvent: (eventId: string) => ReportRecord | undefined;
  /** Creates or regenerates the report for an event (status GENERATED) and returns the record. */
  generate: (eventId: string) => ReportRecord;
  saveDraft: (eventId: string) => ReportRecord;
  markExported: (eventId: string) => void;
  /** False when the browser refused to persist records (private mode, quota): they last for this session only. */
  persisted: boolean;
}
const ReportCtx = createContext<Ctx | null>(null);

/** Reads saved records; anything malformed is discarded so a bad value can never break the app. */
function load(): Store {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Store = {};
    for (const [eventId, v] of Object.entries(parsed as Record<string, unknown>)) {
      const r = v as Partial<ReportRecord> | null;
      if (!r || typeof r.id !== "string" || r.eventId !== eventId || typeof r.generatedAt !== "string" || Number.isNaN(Date.parse(r.generatedAt))) continue;
      if (!STATUSES.includes(r.status as ReportStatus)) continue;
      out[eventId] = {
        id: r.id, eventId, generatedAt: r.generatedAt, status: r.status as ReportStatus,
        exportedAt: typeof r.exportedAt === "string" ? r.exportedAt : null, revision: typeof r.revision === "number" && r.revision > 0 ? r.revision : 1,
      };
    }
    return out;
  } catch { return {}; }
}

export function ReportProvider({ children }: { children: ReactNode }) {
  const { dataset } = useThermalData();
  const [store, setStore] = useState<Store>(load);
  const [persisted, setPersisted] = useState(true);
  const ref = useRef(store);
  ref.current = store;

  useEffect(() => {
    try {
      if (Object.keys(store).length) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      else window.localStorage.removeItem(STORAGE_KEY);
      setPersisted(true);
    } catch { setPersisted(false); }
  }, [store]);

  const commit = useCallback((next: Store) => { ref.current = next; setStore(next); }, []);

  const generate = useCallback((eventId: string): ReportRecord => {
    const prev = ref.current[eventId];
    const rec: ReportRecord = { id: reportIdFor(eventId), eventId, generatedAt: new Date().toISOString(), status: "generated", exportedAt: null, revision: (prev?.revision ?? 0) + 1 };
    commit({ ...ref.current, [eventId]: rec });
    return rec;
  }, [commit]);

  const saveDraft = useCallback((eventId: string): ReportRecord => {
    const prev = ref.current[eventId];
    if (prev) return prev;
    const rec: ReportRecord = { id: reportIdFor(eventId), eventId, generatedAt: new Date().toISOString(), status: "draft", exportedAt: null, revision: 0 };
    commit({ ...ref.current, [eventId]: rec });
    return rec;
  }, [commit]);

  const markExported = useCallback((eventId: string) => {
    const prev = ref.current[eventId];
    if (!prev || prev.status === "draft") return;
    commit({ ...ref.current, [eventId]: { ...prev, status: "exported", exportedAt: new Date().toISOString() } });
  }, [commit]);

  const records = useMemo(() => {
    const ids = new Set(dataset?.events.map((e) => e.id) ?? []);
    return Object.values(store).filter((r) => ids.has(r.eventId)).sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt));
  }, [store, dataset]);
  const forEvent = useCallback((eventId: string) => store[eventId], [store]);

  const value = useMemo(() => ({ records, forEvent, generate, saveDraft, markExported, persisted }), [records, forEvent, generate, saveDraft, markExported, persisted]);
  return <ReportCtx.Provider value={value}>{children}</ReportCtx.Provider>;
}

export function useReports(): Ctx {
  const c = useContext(ReportCtx);
  if (!c) throw new Error("useReports must be used inside ReportProvider");
  return c;
}
