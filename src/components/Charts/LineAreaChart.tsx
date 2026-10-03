import { useEffect, useMemo, useRef, useState } from "react";
import type { TimelinePoint } from "@/types/intelligence";

const H = 232;
const M = { l: 34, r: 12, t: 14, b: 28 };

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(Math.max(240, Math.round(el.clientWidth)));
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setW(Math.max(240, Math.round(el.clientWidth))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Axis maximum rounded up to a multiple of 4 so all four gridline labels are whole numbers. */
const niceMax = (v: number) => Math.max(4, Math.ceil(v / 4) * 4);

interface Props { points: TimelinePoint[]; ariaLabel: string; allLabel: string; urgentLabel: string }

/** Area + line chart of daily detections with a second line for HIGH/CRITICAL locations. Pointer/touch shows the day's values. */
export default function LineAreaChart({ points, ariaLabel, allLabel, urgentLabel }: Props) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const n = points.length;
  const iw = width - M.l - M.r;
  const ih = H - M.t - M.b;

  const g = useMemo(() => {
    const top = niceMax(Math.max(0, ...points.map((p) => p.all)));
    const x = (i: number) => M.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
    const y = (v: number) => M.t + ih - (v / top) * ih;
    const line = (k: "all" | "urgent") => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(" ");
    const area = n ? `${line("all")} L${x(n - 1).toFixed(1)},${(M.t + ih).toFixed(1)} L${x(0).toFixed(1)},${(M.t + ih).toFixed(1)} Z` : "";
    const tickCount = Math.min(n, width < 480 ? 4 : 7);
    const ticks = Array.from({ length: tickCount }, (_, t) => (tickCount === 1 ? 0 : Math.round((t * (n - 1)) / (tickCount - 1))));
    return { top, x, y, allLine: line("all"), urgentLine: line("urgent"), area, ticks };
  }, [points, n, iw, ih, width]);

  const onMove = (clientX: number, rect: DOMRect) => {
    if (n < 1) return;
    const rel = (clientX - rect.left - M.l) / iw;
    setHover(Math.min(n - 1, Math.max(0, Math.round(rel * (n - 1)))));
  };
  const hp = hover != null ? points[hover] : null;
  const tipLeft = hover != null ? Math.min(Math.max(g.x(hover), 80), width - 80) : 0;

  return (
    <div className="lac" ref={ref}>
      <svg width={width} height={H} role="img" aria-label={ariaLabel}
        onPointerMove={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())} onPointerDown={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerLeave={() => setHover(null)}>
        {[0, 1, 2, 3, 4].map((i) => {
          const v = (g.top / 4) * i;
          return (<g key={i}>
            <line x1={M.l} x2={width - M.r} y1={g.y(v)} y2={g.y(v)} className={i === 0 ? "lac-axis" : "lac-grid"} />
            <text x={M.l - 7} y={g.y(v) + 3.5} textAnchor="end" className="lac-tick">{v}</text>
          </g>);
        })}
        {g.ticks.map((i) => <text key={i} x={g.x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="lac-tick">{points[i].label}</text>)}
        {n > 0 && <path d={g.area} className="lac-area" />}
        {n > 0 && <path d={g.allLine} className="lac-line" />}
        {n > 0 && <path d={g.urgentLine} className="lac-line urgent" />}
        {hp && hover != null && (<g>
          <line x1={g.x(hover)} x2={g.x(hover)} y1={M.t} y2={M.t + ih} className="lac-cursor" />
          <circle cx={g.x(hover)} cy={g.y(hp.all)} r={4} className="lac-dot" />
          <circle cx={g.x(hover)} cy={g.y(hp.urgent)} r={4} className="lac-dot urgent" />
        </g>)}
      </svg>
      {hp && (
        <div className="lac-tip" style={{ left: tipLeft }} role="status">
          <b>{hp.label}</b>
          <span><i className="sw on" />{allLabel}: <strong className="mono">{hp.all}</strong></span>
          <span><i className="sw urg" />{urgentLabel}: <strong className="mono">{hp.urgent}</strong></span>
        </div>
      )}
    </div>
  );
}
