import type { Facility, ThermalEvent } from "@/types";
import type { ReportMapGeometry } from "@/types/reports";
import { PROXIMITY_RANGE_KM } from "@/services/analysis/engine";

const KM_PER_DEG = 111.195;

/** Local equirectangular offsets (km east, km north) of a point relative to the event. Accurate enough at facility scale. */
function offset(e: { lat: number; lon: number }, p: { lat: number; lon: number }) {
  return { x: (p.lon - e.lon) * KM_PER_DEG * Math.cos((e.lat * Math.PI) / 180), y: (p.lat - e.lat) * KM_PER_DEG };
}

/**
 * Geometry for the report's schematic map. Facilities come from the existing assessment (nearest + up to three nearest);
 * those inside the engine's proximity range are plotted, the nearest facility is always plotted. No imagery is involved.
 */
export function buildMapGeometry(event: ThermalEvent, neighbours: { facility: Facility; km: number }[]): ReportMapGeometry {
  const plotted = neighbours.filter((n, i) => i === 0 || n.km <= PROXIMITY_RANGE_KM);
  const points: ReportMapGeometry["points"] = [{ kind: "event", label: "E", name: event.id, x: 0, y: 0 }];
  const zones: ReportMapGeometry["zones"] = [];
  plotted.forEach((n, i) => {
    const o = offset(event, n.facility);
    points.push({ kind: "facility", label: `F${i + 1}`, name: n.facility.name, x: o.x, y: o.y });
    zones.push({ x: o.x, y: o.y, rKm: 1 });
  });
  // The view always contains the event, every plotted facility and the nearest facility's whole 1 km zone.
  const xs = [0, ...zones.flatMap((z) => [z.x - z.rKm, z.x + z.rKm])];
  const ys = [0, ...zones.flatMap((z) => [z.y - z.rKm, z.y + z.rKm])];
  let [minX, maxX, minY, maxY] = [Math.min(...xs, -1), Math.max(...xs, 1), Math.min(...ys, -1), Math.max(...ys, 1)];
  const pad = Math.max(maxX - minX, maxY - minY) * 0.08;
  minX -= pad; maxX += pad; minY -= pad; maxY += pad;
  const span = Math.max(maxX - minX, maxY - minY);
  const nice = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
  const scaleKm = nice.find((n) => n >= span / 6) ?? 500;
  const hidden = neighbours.length - plotted.length;
  return {
    points, zones, bounds: { minX, maxX, minY, maxY }, scaleKm,
    note: `Schematic plot from event and facility coordinates (north up, straight-line distances). No basemap or satellite imagery is shown.${hidden > 0 ? ` ${hidden} further listed ${hidden === 1 ? "facility lies" : "facilities lie"} beyond ${PROXIMITY_RANGE_KM} km and ${hidden === 1 ? "is" : "are"} not plotted.` : ""}`,
  };
}

/** Maps local km coordinates into a w x h box (preserving aspect ratio, centred). y grows downward in the result. */
export function makeProjector(g: ReportMapGeometry, w: number, h: number) {
  const bw = g.bounds.maxX - g.bounds.minX, bh = g.bounds.maxY - g.bounds.minY;
  const s = Math.min(w / bw, h / bh);
  const ox = (w - bw * s) / 2, oy = (h - bh * s) / 2;
  return { scale: s, px: (x: number) => ox + (x - g.bounds.minX) * s, py: (y: number) => oy + (g.bounds.maxY - y) * s };
}
