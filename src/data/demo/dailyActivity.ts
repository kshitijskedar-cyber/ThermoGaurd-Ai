import type { ThermalDataset } from "@/types";
import { hash, rng } from "./history";

/**
 * DEMO repository for per-day activity. The dataset only carries a 10-day simulated observation window per event.
 * To support 7/30/90-day views, days OUTSIDE an event's own window are generated deterministically from that event's
 * own detection rate (active days / window days), using a seeded generator keyed on event id + calendar day.
 * Consequences: identical output on every refresh, the 7-day view is always a subset of the 30-day view, and days
 * inside the real observation window are used exactly as stored. A live data source would implement the same
 * `DailyActivity` shape from real observations and the rest of the app would not change.
 */
export interface DailyActivity { dayKeys: string[]; active: Record<string, boolean[]> }

const IST_OFFSET_MS = 5.5 * 3600e3;
const DAY_MS = 864e5;

/** Calendar day (YYYY-MM-DD) in India Standard Time, matching the formatting used across the UI. */
export const istDayKey = (iso: string) => new Date(Date.parse(iso) + IST_OFFSET_MS).toISOString().slice(0, 10);
const shiftKey = (key: string, days: number) => new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

export function demoDailyActivity(ds: ThermalDataset, days: number): DailyActivity {
  const refKey = istDayKey(ds.referenceTime);
  const dayKeys = Array.from({ length: days }, (_, i) => shiftKey(refKey, i - (days - 1)));
  const active: Record<string, boolean[]> = {};
  for (const e of ds.events) {
    const obs = ds.history[e.id] ?? [];
    const observed = new Map(obs.map((o) => [istDayKey(o.date), o.active]));
    const total = obs.length || e.persistenceTotal;
    const rate = total ? (obs.length ? obs.filter((o) => o.active).length : e.persistenceActive) / total : 0;
    active[e.id] = dayKeys.map((k) => observed.get(k) ?? rng(hash(`${e.id}|${k}`))() < rate);
  }
  return { dayKeys, active };
}

/**
 * LIVE repository: days come only from the FIRMS observation window carried in `ds.history`. A day outside that window,
 * or a day without a detection, is simply not active. Nothing is simulated or extrapolated.
 */
export function liveDailyActivity(ds: ThermalDataset, days: number): DailyActivity {
  const refKey = istDayKey(ds.referenceTime);
  const dayKeys = Array.from({ length: days }, (_, i) => shiftKey(refKey, i - (days - 1)));
  const active: Record<string, boolean[]> = {};
  for (const e of ds.events) {
    const observed = new Map((ds.history[e.id] ?? []).map((o) => [istDayKey(o.date), o.active]));
    active[e.id] = dayKeys.map((k) => observed.get(k) === true);
  }
  return { dayKeys, active };
}
