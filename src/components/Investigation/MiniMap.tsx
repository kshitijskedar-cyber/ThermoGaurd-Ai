import { useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { EventAssessment, ThermalEvent } from "@/types";
import { BASEMAPS, buildStyle, type BasemapId } from "@/components/Map/basemaps";
import { destinationPoint } from "@/services/geospatial/geo";

/** Focused map: the selected event, its nearest facility, the connecting line and the 1 km facility zone. */
export default function MiniMap({ event, a }: { event: ThermalEvent; a: EventAssessment }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [basemap, setBasemap] = useState<BasemapId>("satellite");

  useEffect(() => {
    if (!el.current) return;
    let map: MlMap;
    try { map = new maplibregl.Map({ container: el.current, style: buildStyle("satellite"), center: [event.lon, event.lat], zoom: 12, attributionControl: { compact: true } }); }
    catch { setFailed(true); return; }
    mapRef.current = map;
    map.on("load", () => {
      for (const id of ["zone", "link", "pts"]) map.addSource(id, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "zone-fill", type: "fill", source: "zone", paint: { "fill-color": "#d2692f", "fill-opacity": 0.12 } });
      map.addLayer({ id: "zone-line", type: "line", source: "zone", paint: { "line-color": "#d2692f", "line-width": 1.2, "line-dasharray": [3, 2] } });
      map.addLayer({ id: "link", type: "line", source: "link", paint: { "line-color": "#ffffff", "line-width": 2, "line-dasharray": [2, 2] } });
      map.addLayer({ id: "pts", type: "circle", source: "pts", paint: {
        "circle-radius": ["case", ["==", ["get", "kind"], "event"], 9, 7],
        "circle-color": ["case", ["==", ["get", "kind"], "event"], "#bd3f3a", "#10202e"], "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
      setReady(true);
    });
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(el.current);
    return () => { ro.disconnect(); map.remove(); mapRef.current = null; setReady(false); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const fc = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features });
    const pt = (lon: number, lat: number, kind: string): GeoJSON.Feature => ({ type: "Feature", geometry: { type: "Point", coordinates: [lon, lat] }, properties: { kind } });
    const f = a.nearest?.facility;
    (map.getSource("pts") as GeoJSONSource).setData(fc([pt(event.lon, event.lat, "event"), ...(f ? [pt(f.lon, f.lat, "facility")] : [])]));
    (map.getSource("link") as GeoJSONSource).setData(fc(f ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[event.lon, event.lat], [f.lon, f.lat]] } }] : []));
    (map.getSource("zone") as GeoJSONSource).setData(fc(f ? [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [Array.from({ length: 49 }, (_, i) => { const [la, lo] = destinationPoint(f.lat, f.lon, (i * 360) / 48, 1); return [lo, la]; })] } }] : []));
    if (f) {
      const b = new maplibregl.LngLatBounds([event.lon, event.lat], [event.lon, event.lat]).extend([f.lon, f.lat]);
      b.extend([f.lon - 0.011, f.lat - 0.009]).extend([f.lon + 0.011, f.lat + 0.009]);
      map.fitBounds(b, { padding: 40, maxZoom: 14, duration: 0 });
    } else map.jumpTo({ center: [event.lon, event.lat], zoom: 12 });
  }, [ready, event, a]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const b of BASEMAPS) map.setLayoutProperty(b.source, "visibility", b.id === basemap ? "visible" : "none");
  }, [ready, basemap]);

  return (
    <div className="mini-map">
      <div className="mini-map-gl" ref={el} role="application" aria-label="Map of the selected event and its nearest facility" />
      {failed ? <div className="map-fallback" role="alert"><strong>Map unavailable</strong><span>WebGL is not available in this browser.</span></div> : (
        <>
          <div className="mini-map-toggle">
            {(["satellite", "streets"] as const).map((b) => <button key={b} className={basemap === b ? "active" : ""} onClick={() => setBasemap(b)}>{b === "satellite" ? "Satellite" : "Streets"}</button>)}
          </div>
          <div className="mini-map-legend"><span><i className="lg ev" />Event</span><span><i className="lg fc" />{a.nearest ? a.nearest.facility.name : "Facility"}</span><span><i className="lg zn" />1 km zone</span></div>
        </>
      )}
    </div>
  );
}
