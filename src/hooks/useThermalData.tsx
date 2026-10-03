import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { EventAssessment, ThermalDataset } from "@/types";
import { analyseDataset } from "@/services/analysis/engine";
import { activeDataService } from "@/services/dataService";
import { describeSource, type SourceInfo } from "@/services/live/sourceInfo";
import { isAbort } from "@/services/live/errors";

type Status = "loading" | "ready" | "error";
interface Ctx {
  status: Status; dataset: ThermalDataset | null; assessments: Record<string, EventAssessment>;
  /** Reloads the data. In live mode this bypasses the short-lived caches (the manual Refresh action). */
  reload: () => void;
  /** True while a reload is running and the previous data is still on screen. */
  refreshing: boolean;
  source: SourceInfo;
  selectedId: string | null; select: (id: string | null) => void;
}
const ThermalCtx = createContext<Ctx | null>(null);

export function ThermalDataProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [dataset, setDataset] = useState<ThermalDataset | null>(null);
  const [assessments, setAssessments] = useState<Record<string, EventAssessment>>({});
  const [selectedId, select] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);
  const busy = useRef(false); // one load at a time: repeated clicks or renders never start a second request
  const first = useRef(true);

  useEffect(() => {
    let live = true; // not an AbortSignal: concurrent callers share one in-flight live request, which must not be cancelled by one of them
    const initial = first.current;
    first.current = false;
    busy.current = true;
    if (initial || !dataset) setStatus("loading"); else setRefreshing(true); // a refresh keeps the current data visible
    activeDataService.load({ force: nonce > 0 }).then(
      (ds) => {
        if (!live) return;
        // The same pipeline for demo and live data: the transparent classification + risk engine.
        const analysed = analyseDataset(ds);
        setDataset(analysed.dataset);
        setAssessments(analysed.assessments);
        const ids = new Set(analysed.dataset.events.map((e) => e.id));
        // Open on the highest-priority event; keep the current selection if it still exists after a refresh.
        const top = [...analysed.dataset.events].sort((a, b) => analysed.assessments[b.id].riskScore - analysed.assessments[a.id].riskScore)[0];
        select((cur) => (cur && ids.has(cur) ? cur : top?.id ?? null));
        setStatus("ready");
        setRefreshing(false);
        busy.current = false;
      },
      (e) => {
        if (!live || isAbort(e)) return;
        console.warn("[ThermoGuard] Data load failed:", e);
        busy.current = false;
        setRefreshing(false);
        // A failed refresh keeps the previous data on screen rather than blanking the application.
        setStatus((s) => (dataset ? s : "error"));
      },
    );
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  const reload = useCallback(() => { if (!busy.current) setNonce((n) => n + 1); }, []);
  const source = useMemo(() => describeSource(dataset), [dataset]);
  const value = useMemo(() => ({ status, dataset, assessments, reload, refreshing, source, selectedId, select }), [status, dataset, assessments, reload, refreshing, source, selectedId]);
  return <ThermalCtx.Provider value={value}>{children}</ThermalCtx.Provider>;
}

export function useThermalData(): Ctx {
  const c = useContext(ThermalCtx);
  if (!c) throw new Error("useThermalData must be used inside ThermalDataProvider");
  return c;
}
