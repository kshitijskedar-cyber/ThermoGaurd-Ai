import type { Classification, Observation, ThermalEvent } from "@/types";

/**
 * SIMULATED observation history for the demo dataset. One entry per day for `persistenceTotal` days, ending on the
 * event's own day. The number of active days always equals `event.persistenceActive`; the event's day is always active.
 * The demo scenario author decides whether a site is steady or newly spiking (by the seed label); the analysis engine
 * never sees that label, it only reads the resulting observations.
 */
export function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ratio of the event's FRP to the typical earlier FRP at that location, by scenario. [min, max] */
const RATIO: Record<Classification, [number, number]> = {
  industrial_fire: [2.0, 3.0], wildfire: [1.8, 2.6], agri_burning: [1.0, 1.6], unknown: [1.0, 1.5],
  persistent_heat: [0.92, 1.08], gas_flare: [0.85, 1.2], mining: [0.85, 1.25],
};

export function generateObservations(e: ThermalEvent): Observation[] {
  const r = rng(hash(e.id));
  const n = e.persistenceTotal;
  const activeCount = Math.min(Math.max(e.persistenceActive, 1), n);
  // The last day is the event itself. Choose the remaining active days at random from the earlier days.
  const earlier = Array.from({ length: n - 1 }, (_, i) => i);
  for (let i = earlier.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [earlier[i], earlier[j]] = [earlier[j], earlier[i]]; }
  const activeDays = new Set(earlier.slice(0, activeCount - 1));
  const [lo, hi] = RATIO[e.classification];
  const baseline = e.frpMw / (lo + r() * (hi - lo));
  const end = Date.parse(e.detectedAt);
  return Array.from({ length: n }, (_, i) => {
    const isLast = i === n - 1;
    const active = isLast || activeDays.has(i);
    const frp = isLast ? e.frpMw : active ? Math.round(baseline * (0.85 + r() * 0.3) * 10) / 10 : null;
    return { day: i + 1, date: new Date(end - (n - 1 - i) * 864e5).toISOString(), active, frpMw: frp };
  });
}

export function generateDemoHistory(events: ThermalEvent[]): Record<string, Observation[]> {
  return Object.fromEntries(events.map((e) => [e.id, generateObservations(e)]));
}
