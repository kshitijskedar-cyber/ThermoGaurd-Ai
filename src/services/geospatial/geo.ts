import type { FeatureCollection } from "geojson";
import type { Facility, ThermalEvent } from "@/types";
import { CLASS_LABEL, RISK_LABEL, eventTone, formatIST, formatSensorConfidence } from "@/utils/format";

const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function destinationPoint(lat: number, lon: number, bearingDeg: number, km: number): [number, number] {
  const b = rad(bearingDeg);
  const d = km / R;
  const p1 = rad(lat);
  const l1 = rad(lon);
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [deg(p2), deg(l2)];
}

export function nearestFacility(lat: number, lon: number, facilities: Facility[]): { facility: Facility; km: number } | null {
  let best: { facility: Facility; km: number } | null = null;
  for (const f of facilities) {
    const km = haversineKm(lat, lon, f.lat, f.lon);
    if (!best || km < best.km) best = { facility: f, km };
  }
  return best;
}

/** The `n` nearest facilities in one pass (ties keep dataset order), closest first. */
export function nearestFacilities(lat: number, lon: number, facilities: Facility[], n: number): { facility: Facility; km: number }[] {
  const best: { facility: Facility; km: number }[] = [];
  for (const f of facilities) {
    const km = haversineKm(lat, lon, f.lat, f.lon);
    if (best.length === n && km >= best[n - 1].km) continue;
    let i = best.length;
    while (i > 0 && km < best[i - 1].km) i--;
    best.splice(i, 0, { facility: f, km });
    if (best.length > n) best.pop();
  }
  return best;
}

type FC = FeatureCollection;

export function eventsToGeoJSON(events: ThermalEvent[]): FC {
  return {
    type: "FeatureCollection",
    features: events.map((e) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [e.lon, e.lat] },
      properties: {
        id: e.id, tone: eventTone(e), frp: e.frpMw, classLabel: CLASS_LABEL[e.classification],
        riskLabel: RISK_LABEL[e.risk], confidence: formatSensorConfidence(e),
        src: e.source ?? "demo", acquired: formatIST(e.detectedAt), sensor: `${e.instrument} / ${e.satellite}`,
      },
    })),
  };
}

export function facilitiesToGeoJSON(facilities: Facility[]): FC {
  return {
    type: "FeatureCollection",
    features: facilities.map((f) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [f.lon, f.lat] },
      // `label` is empty for unnamed OSM objects so thousands of placeholder names never clutter the map.
      properties: { id: f.id, name: f.name, label: f.unnamed ? "" : f.name, type: f.type, region: f.region, src: f.source ?? "demo", osmRef: f.osmRef ?? "" },
    })),
  };
}

/** 1 km buffer polygons around each facility (planar approximation via destinationPoint). */
export function zonesToGeoJSON(facilities: Facility[], km = 1): FC {
  const seg = facilities.length > 400 ? 16 : 48; // live OSM data can hold thousands of objects: keep the buffers light
  return {
    type: "FeatureCollection",
    features: facilities.map((f) => {
      const ring = Array.from({ length: seg + 1 }, (_, i) => {
        const [lat, lon] = destinationPoint(f.lat, f.lon, (i * 360) / seg, km);
        return [lon, lat];
      });
      return { type: "Feature", geometry: { type: "Polygon", coordinates: [ring] }, properties: { id: f.id } };
    }),
  };
}

export function boundsOf(events: { lat: number; lon: number }[]): [[number, number], [number, number]] | null {
  if (!events.length) return null;
  const lons = events.map((e) => e.lon);
  const lats = events.map((e) => e.lat);
  return [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
}
