import type { ThermalDataset, ThermalEvent } from "@/types";
import type { TimelinePoint, TimelineResult } from "@/types/intelligence";
import { demoDailyActivity, liveDailyActivity } from "@/data/demo/dailyActivity";

export const TIMELINE_RANGES = [7, 30, 90] as const;
export type TimelineRange = (typeof TIMELINE_RANGES)[number];

const dayLabel = (key: string) =>
  new Date(`${key}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });

/**
 * Daily detection counts. A "detection" is a monitored location (one per thermal event) with a thermal observation
 * that day. `urgent` counts only locations whose event is rated HIGH or CRITICAL by the Phase 2 engine.
 * Demo mode uses the simulated repository; live mode uses ONLY the FIRMS observation window (no day is generated).
 */
export function buildTimeline(ds: ThermalDataset, days: number, filter?: (e: ThermalEvent) => boolean): TimelineResult {
  const activity = ds.mode === "live" ? liveDailyActivity(ds, days) : demoDailyActivity(ds, days);
  const events = filter ? ds.events.filter(filter) : ds.events;
  const points: TimelinePoint[] = activity.dayKeys.map((key, i) => {
    let all = 0, urgent = 0;
    for (const e of events) {
      if (!activity.active[e.id]?.[i]) continue;
      all++;
      if (e.risk === "critical" || e.risk === "high") urgent++;
    }
    return { date: key, label: dayLabel(key), all, urgent };
  });
  const total = points.reduce((a, p) => a + p.all, 0);
  const peak = points.reduce<TimelinePoint | null>((best, p) => (!best || p.all > best.all ? p : best), null);
  return { days, points, total, mean: points.length ? total / points.length : 0, peak };
}
