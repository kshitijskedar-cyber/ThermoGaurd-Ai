import { useState } from "react";
import type { EventAssessment, ThermalEvent } from "@/types";
import type { ReportMapGeometry } from "@/types/reports";
import { makeProjector } from "@/services/reports/mapGeometry";
import MiniMap from "@/components/Investigation/MiniMap";

const W = 720, H = 300;

/**
 * Report map. The default view is the schematic plot (same geometry as the PDF page), which needs no network and prints
 * cleanly. An interactive basemap view reuses the Phase 2 MiniMap and is shown on screen only.
 */
export default function ReportMapPanel({ geometry: g, event, assessment }: { geometry: ReportMapGeometry; event: ThermalEvent; assessment: EventAssessment }) {
  const [mode, setMode] = useState<"schematic" | "interactive">("schematic");
  const pr = makeProjector(g, W, H);
  const near = g.points.find((p) => p.kind === "facility");
  const sb = g.scaleKm * pr.scale;
  const grid = (min: number, max: number) => { const out: number[] = []; for (let v = Math.ceil(min / g.scaleKm) * g.scaleKm; v <= max; v += g.scaleKm) out.push(v); return out; };
  return (
    <figure className="rpt-map">
      <div className="rpt-map-tools no-print" role="group" aria-label="Map view">
        <button className={mode === "schematic" ? "active" : ""} aria-pressed={mode === "schematic"} onClick={() => setMode("schematic")}>Report plot</button>
        <button className={mode === "interactive" ? "active" : ""} aria-pressed={mode === "interactive"} onClick={() => setMode("interactive")}>Interactive map</button>
      </div>
      {mode === "interactive" ? (
        <div className="no-print"><MiniMap event={event} a={assessment} /></div>
      ) : null}
      <svg className={`rpt-map-svg ${mode === "interactive" ? "print-only" : ""}`} viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`Schematic map of event ${event.id} and ${g.points.length - 1} nearby ${g.points.length === 2 ? "facility" : "facilities"}`}>
        <rect width={W} height={H} className="m-bg" />
        {grid(g.bounds.minX, g.bounds.maxX).map((v) => <line key={`x${v}`} x1={pr.px(v)} x2={pr.px(v)} y1={0} y2={H} className="m-grid" />)}
        {grid(g.bounds.minY, g.bounds.maxY).map((v) => <line key={`y${v}`} y1={pr.py(v)} y2={pr.py(v)} x1={0} x2={W} className="m-grid" />)}
        {g.zones.map((z, i) => <circle key={i} cx={pr.px(z.x)} cy={pr.py(z.y)} r={z.rKm * pr.scale} className="m-zone" />)}
        {near && <line x1={pr.px(0)} y1={pr.py(0)} x2={pr.px(near.x)} y2={pr.py(near.y)} className="m-link" />}
        {g.points.map((p) => p.kind === "facility" ? (
          <g key={p.label}><rect x={pr.px(p.x) - 6} y={pr.py(p.y) - 6} width={12} height={12} className="m-fac" /><text x={pr.px(p.x) + 10} y={pr.py(p.y) - 8} className="m-label"><title>{p.name}</title>{p.label}</text></g>
        ) : (
          <g key="e"><circle cx={pr.px(0)} cy={pr.py(0)} r={7} className="m-ev" /><text x={pr.px(0) + 12} y={pr.py(0) + 15} className="m-label ev">E · {p.name}</text></g>
        ))}
        <g transform={`translate(14 ${H - 16})`}><line x2={sb} className="m-scale" /><line y1={-4} y2={4} className="m-scale" /><line x1={sb} x2={sb} y1={-4} y2={4} className="m-scale" /><text x={sb / 2} y={-8} textAnchor="middle" className="m-small">{g.scaleKm} km</text></g>
        <g transform={`translate(${W - 22} 14)`}><path d="M0 0 L-6 16 L6 16 Z" className="m-north" /><text y={30} textAnchor="middle" className="m-small">N</text></g>
      </svg>
      <figcaption className="rpt-map-cap">
        <span><i className="lg ev" />E thermal event</span><span><i className="lg sq" />F1 to F3 nearby facilities (section 7)</span><span><i className="lg zn" />1 km facility zone</span>
        <small>{g.note}</small>
      </figcaption>
    </figure>
  );
}
