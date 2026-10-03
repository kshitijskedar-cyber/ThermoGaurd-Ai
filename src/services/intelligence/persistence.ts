import type { PersistenceStats } from "@/types";
import type { PersistenceKey, PersistenceStatus } from "@/types/intelligence";

/** Same cut-off the Phase 1 "Persistent Sources" KPI uses: 6 of 10 observation days. */
export const PERSISTENT_RATIO = 0.6;
export const INTERMITTENT_RATIO = 0.3;

const LABEL: Record<PersistenceKey, string> = { persistent: "Persistent", intermittent: "Intermittent", isolated: "Isolated", unavailable: "Unavailable" };

export function persistenceKey(ratio: number): PersistenceKey {
  return ratio >= PERSISTENT_RATIO ? "persistent" : ratio >= INTERMITTENT_RATIO ? "intermittent" : "isolated";
}

/** Turns the engine's PersistenceStats into a labelled status. No new calculation: it only bands the engine's active/total. */
export function persistenceStatus(p: PersistenceStats): PersistenceStatus {
  // Live mode with too little FIRMS history: say so instead of banding a meaningless ratio.
  if (!p.available) return { key: "unavailable", label: LABEL.unavailable, active: p.active, total: p.total, ratio: 0, percent: 0, available: false };
  const ratio = p.total ? p.active / p.total : 0;
  const key = persistenceKey(ratio);
  return { key, label: LABEL[key], active: p.active, total: p.total, ratio, percent: Math.round(ratio * 100), available: true };
}
