import { useMemo, useState } from "react";
import type { ThermalDataset, ThermalEvent } from "@/types";
import { buildTimeline, TIMELINE_RANGES, type TimelineRange } from "@/services/intelligence/timeline";
import { Panel } from "@/components/Investigation/parts";
import LineAreaChart from "./LineAreaChart";
import { DataTag } from "@/components/common/SourceTag";
import { useThermalData } from "@/hooks/useThermalData";

interface Props {
  ds: ThermalDataset;
  eyebrow: string;
  title: string;
  /** Restrict the chart to some events (for example, one facility's related events). */
  filter?: (e: ThermalEvent) => boolean;
  defaultRange?: TimelineRange;
  subject: string; // wording used in the summary, e.g. "monitored locations"
  id?: string;
}

/** Range-selectable detection timeline used by Analytics (all events) and Facility Intelligence (one facility). */
export default function TimelinePanel({ ds, eyebrow, title, filter, defaultRange = 30, subject, id }: Props) {
  const { source } = useThermalData();
  const [range, setRange] = useState<TimelineRange>(defaultRange);
  const t = useMemo(() => buildTimeline(ds, range, filter), [ds, range, filter]);
  const empty = t.total === 0;
  return (
    <Panel id={id} eyebrow={eyebrow} title={title}
      aside={<div className="panel-tools">
        <DataTag />
        <div className="seg" role="group" aria-label="Time range">
          {TIMELINE_RANGES.map((r) => <button key={r} aria-pressed={range === r} className={range === r ? "active" : ""} onClick={() => setRange(r)}>{r} days</button>)}
        </div>
      </div>}>
      <div className="tl-stats">
        <div><small>DETECTIONS IN {range} DAYS</small><strong className="mono">{t.total}</strong></div>
        <div><small>DAILY MEAN</small><strong className="mono">{t.mean.toFixed(1)}</strong></div>
        <div><small>PEAK DAY</small><strong className="mono">{t.peak && t.peak.all > 0 ? `${t.peak.all} · ${t.peak.label}` : "—"}</strong></div>
      </div>
      {empty
        ? <p className="inv-note">No thermal detections fall inside this window for the selected scope.</p>
        : <LineAreaChart points={t.points} allLabel="All detections" urgentLabel="High / critical"
            ariaLabel={`Daily thermal detections over ${range} days: ${t.total} in total, peak ${t.peak?.all ?? 0} on ${t.peak?.label ?? "n/a"}.`} />}
      <div className="pchart-legend"><span><i className="sw on" />All detections</span><span><i className="sw urg" />High / critical locations</span></div>
      {source.isLive ? (
        <p className="inv-foot">
          LIVE FIRMS DATA. Each location (one per grouped thermal anomaly) counts once per day on which NASA FIRMS reported a detection. Only the {ds.historyWindowDays ?? 5}-day
          FIRMS window is available, so longer ranges show no earlier data; nothing is simulated. A day without a detection can mean no heat or no usable overpass (for example cloud cover).
        </p>
      ) : (
      <p className="inv-foot">
        DEMO DATA. Each monitored location (one per thermal event) counts once per day with a detection. Days inside an event's 10-day
        simulated observation window are used as stored; earlier or later days in the {range}-day view are generated deterministically
        from that location's own detection rate, so the chart is identical on every refresh. This is {subject}, not live satellite data.
      </p>
      )}
    </Panel>
  );
}
