import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Point } from "geojson";
import type { Facility, ThermalEvent } from "@/types";
import Icon from "@/components/common/Icon";
import { BASEMAPS, BASEMAP_SOURCE_IDS, buildStyle, type BasemapId } from "./basemaps";
import { boundsOf, eventsToGeoJSON, facilitiesToGeoJSON, zonesToGeoJSON } from "@/services/geospatial/geo";

interface Props {
  events: ThermalEvent[];
  facilities: Facility[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Also frame the facilities when fitting (facility view, where the site may have no events). */
  fitFacilities?: boolean;
}

const GROUPS = {
  events: ["clusters", "cluster-count", "events-halo", "events-point"],
  facilities: ["facilities-circle", "facilities-label"],
  zones: ["zones-fill", "zones-line"],
} as const;
type GroupId = keyof typeof GROUPS;
const FONT = ["Open Sans Regular", "Arial Unicode MS Regular"];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TONE_COLOR: any = ["match", ["get", "tone"], "critical", "#bd3f3a", "high", "#d2692f", "moderate", "#c48a25", "#53778f"];

/** Popup text comes from data (OSM names are free text), so it is escaped before it goes into HTML. */
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

const popupHtml = (p: Record<string, string | number>) => {
  const live = p.src === "firms";
  // A FIRMS record is a thermal anomaly observation. The class and risk are ThermoGuard's own assessment, not NASA's.
  return `<div class="tg-popup"><div class="tg-popup-id">${esc(p.id)}</div>` +
    (live ? `<div class="tg-popup-src">NASA FIRMS · Thermal anomaly</div>` : "") +
    `<div class="tg-popup-title">${esc(p.classLabel)}</div>` +
    `<div class="tg-popup-row"><span>${live ? "Assessed risk" : "Risk"}</span><b>${esc(p.riskLabel)}</b></div>` +
    `<div class="tg-popup-row"><span>FRP</span><b>${esc(p.frp)} MW</b></div>` +
    `<div class="tg-popup-row"><span>${live ? "Sensor confidence" : "Confidence"}</span><b>${esc(p.confidence)}</b></div>` +
    (live ? `<div class="tg-popup-row"><span>Acquired</span><b>${esc(p.acquired)}</b></div><div class="tg-popup-row"><span>Sensor</span><b>${esc(p.sensor)}</b></div>` : "") +
    `<div class="tg-popup-demo">${live ? "Prototype assessment · not a confirmed fire" : "Demo data"}</div></div>`;
};

const facilityHtml = (p: Record<string, string | number>) => {
  const osm = p.src === "osm";
  return `<div class="tg-popup"><div class="tg-popup-id">${esc(p.id)}</div><div class="tg-popup-title">${esc(p.name)}</div>` +
    `<div class="tg-popup-row"><span>Type</span><b>${esc(p.type)}</b></div><div class="tg-popup-row"><span>Region</span><b>${esc(p.region)}</b></div>` +
    (osm ? `<div class="tg-popup-row"><span>OSM object</span><b>${esc(p.osmRef)}</b></div>` : "") +
    `<div class="tg-popup-demo">${osm ? "OpenStreetMap context" : "Demo facility"}</div></div>`;
};

function addDataLayers(map: MlMap) {
  map.addSource("events", { type: "geojson", data: eventsToGeoJSON([]), cluster: true, clusterRadius: 45, clusterMaxZoom: 9 });
  map.addSource("facilities", { type: "geojson", data: facilitiesToGeoJSON([]) });
  map.addSource("zones", { type: "geojson", data: zonesToGeoJSON([]) });
  map.addLayer({ id: "zones-fill", type: "fill", source: "zones", paint: { "fill-color": "#d2692f", "fill-opacity": 0.1 } });
  map.addLayer({ id: "zones-line", type: "line", source: "zones", paint: { "line-color": "#d2692f", "line-width": 1, "line-dasharray": [3, 2] } });
  map.addLayer({
    id: "facilities-circle", type: "circle", source: "facilities",
    paint: { "circle-radius": 6.5, "circle-color": "#10202e", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 },
  });
  map.addLayer({
    id: "facilities-label", type: "symbol", source: "facilities", minzoom: 7,
    layout: { "text-field": ["get", "label"], "text-font": FONT, "text-size": 11, "text-offset": [0, 1.2], "text-anchor": "top", "text-optional": true },
    paint: { "text-color": "#10202e", "text-halo-color": "#ffffff", "text-halo-width": 1.5 },
  });
  map.addLayer({
    id: "clusters", type: "circle", source: "events", filter: ["has", "point_count"],
    paint: {
      "circle-color": "#1f4d73", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2,
      "circle-radius": ["step", ["get", "point_count"], 15, 5, 19, 12, 24],
    },
  });
  map.addLayer({
    id: "cluster-count", type: "symbol", source: "events", filter: ["has", "point_count"],
    layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": FONT, "text-size": 12, "text-allow-overlap": true },
    paint: { "text-color": "#ffffff" },
  });
  map.addLayer({
    id: "events-halo", type: "circle", source: "events", filter: ["==", ["get", "id"], ""],
    paint: { "circle-radius": 17, "circle-color": "rgba(255,255,255,0.18)", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 },
  });
  map.addLayer({
    id: "events-point", type: "circle", source: "events", filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": TONE_COLOR, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.5,
      "circle-radius": ["interpolate", ["linear"], ["get", "frp"], 5, 5.5, 120, 11],
    },
  });
}

export default function ThermalMap({ events, facilities, selectedId, onSelect, fitFacilities }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<HTMLDivElement>(null);
  const coordRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const userMarker = useRef<maplibregl.Marker | null>(null);
  const latest = useRef({ events, facilities, onSelect, fitFacilities });
  latest.current = { events, facilities, onSelect, fitFacilities };

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [basemap, setBasemap] = useState<BasemapId>("streets");
  const [vis, setVis] = useState<Record<GroupId, boolean>>({ events: true, facilities: true, zones: true });
  const [panelOpen, setPanelOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const fit = useCallback((animate = true) => {
    const map = mapRef.current;
    const l = latest.current;
    const b = boundsOf(l.fitFacilities ? [...l.events, ...l.facilities] : l.events);
    if (map && b) map.fitBounds(b, { padding: 70, maxZoom: 10, duration: animate ? 700 : 0 });
  }, []);

  // Create the map once.
  useEffect(() => {
    if (!glRef.current) return;
    let map: MlMap;
    try {
      map = new maplibregl.Map({ container: glRef.current, style: buildStyle(), center: [74, 20], zoom: 5, minZoom: 3, attributionControl: { compact: true } });
    } catch {
      setFailed("The interactive map could not start because WebGL is unavailable in this browser.");
      return;
    }
    mapRef.current = map;
    const popup = new maplibregl.Popup({ offset: 12, maxWidth: "240px" });

    map.on("error", (ev) => {
      const src = (ev as unknown as { sourceId?: string }).sourceId;
      if (src && BASEMAP_SOURCE_IDS.includes(src)) setNotice("Basemap tiles could not be loaded. Event and facility layers remain available.");
    });
    map.on("load", () => {
      addDataLayers(map);
      map.on("click", "events-point", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        latest.current.onSelect(String(f.properties.id));
        popup.setLngLat((f.geometry as Point).coordinates as [number, number]).setHTML(popupHtml(f.properties)).addTo(map);
      });
      map.on("click", "facilities-circle", (e) => {
        const f = e.features?.[0];
        if (f) popup.setLngLat((f.geometry as Point).coordinates as [number, number]).setHTML(facilityHtml(f.properties)).addTo(map);
      });
      map.on("click", "clusters", async (e) => {
        const f = map.queryRenderedFeatures(e.point, { layers: ["clusters"] })[0];
        if (!f) return;
        const zoom = await (map.getSource("events") as GeoJSONSource).getClusterExpansionZoom(f.properties.cluster_id);
        map.easeTo({ center: (f.geometry as Point).coordinates as [number, number], zoom });
      });
      for (const layer of ["events-point", "facilities-circle", "clusters"]) {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }
      setReady(true);
    });
    map.on("move", () => {
      const c = map.getCenter();
      if (coordRef.current)
        coordRef.current.textContent = `${Math.abs(c.lat).toFixed(4)}° ${c.lat >= 0 ? "N" : "S"}  ${Math.abs(c.lng).toFixed(4)}° ${c.lng >= 0 ? "E" : "W"}  ·  ZOOM ${map.getZoom().toFixed(1)}`;
    });
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(glRef.current);
    return () => { ro.disconnect(); userMarker.current?.remove(); map.remove(); mapRef.current = null; setReady(false); };
  }, []);

  // Push data into the map whenever it changes; fit once on first load.
  const fitted = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("events") as GeoJSONSource).setData(eventsToGeoJSON(events));
    (map.getSource("facilities") as GeoJSONSource).setData(facilitiesToGeoJSON(facilities));
    (map.getSource("zones") as GeoJSONSource).setData(zonesToGeoJSON(facilities));
    if (!fitted.current) { fitted.current = true; fit(false); }
  }, [ready, events, facilities, fit]);

  // Selection highlight; recentre only when the selected event is off-screen.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setFilter("events-halo", ["==", ["get", "id"], selectedId ?? ""]);
    const ev = latest.current.events.find((e) => e.id === selectedId);
    if (ev && !map.getBounds().contains([ev.lon, ev.lat])) map.easeTo({ center: [ev.lon, ev.lat], zoom: Math.max(map.getZoom(), 8), duration: 600 });
  }, [ready, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const g of Object.keys(GROUPS) as GroupId[])
      for (const id of GROUPS[g]) map.setLayoutProperty(id, "visibility", vis[g] ? "visible" : "none");
  }, [ready, vis]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const b of BASEMAPS) map.setLayoutProperty(b.source, "visibility", b.id === basemap ? "visible" : "none");
  }, [ready, basemap]);

  useEffect(() => {
    const onFs = () => { setFullscreen(document.fullscreenElement === wrapRef.current); mapRef.current?.resize(); };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const locate = () => {
    if (!navigator.geolocation) return setNotice("Location is not available in this browser.");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const map = mapRef.current;
        if (!map) return;
        const c: [number, number] = [p.coords.longitude, p.coords.latitude];
        userMarker.current?.remove();
        const el = document.createElement("div");
        el.className = "user-dot";
        userMarker.current = new maplibregl.Marker({ element: el }).setLngLat(c).addTo(map);
        map.flyTo({ center: c, zoom: 10 });
      },
      () => setNotice("Your location could not be determined. Check browser location permission."),
      { timeout: 8000 },
    );
  };
  const toggleFullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : wrapRef.current?.requestFullscreen?.());

  return (
    <div className="map-canvas" ref={wrapRef}>
      <div className="map-gl" ref={glRef} role="application" aria-label="Interactive thermal events map" />
      {failed ? (
        <div className="map-fallback" role="alert"><strong>Map unavailable</strong><span>{failed}</span></div>
      ) : (
        <>
          <div className="map-zoom">
            <button title="Zoom in" aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}><Icon name="plus" size={17} /></button>
            <button title="Zoom out" aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()}><Icon name="minus" size={17} /></button>
          </div>
          <div className="map-tools">
            <button title="Show my location" aria-label="Show my location" onClick={locate}><Icon name="locate" size={17} /></button>
            <button title="Map layers" aria-label="Map layers" aria-pressed={panelOpen} className={panelOpen ? "active" : ""} onClick={() => setPanelOpen(!panelOpen)}><Icon name="layers" size={17} /></button>
            <button title="Fit to all events" aria-label="Fit to all events" onClick={() => fit()}><Icon name="scan" size={17} /></button>
            <button title={fullscreen ? "Exit fullscreen" : "Fullscreen"} aria-label="Toggle fullscreen" onClick={toggleFullscreen}><Icon name="expand" size={17} /></button>
          </div>
          {panelOpen && (
            <div className="layer-popover">
              <strong>MAP LAYERS</strong>
              <label><input type="checkbox" checked={vis.events} onChange={() => setVis({ ...vis, events: !vis.events })} /> Thermal events</label>
              <label><input type="checkbox" checked={vis.facilities} onChange={() => setVis({ ...vis, facilities: !vis.facilities })} /> Industrial facilities</label>
              <label><input type="checkbox" checked={vis.zones} onChange={() => setVis({ ...vis, zones: !vis.zones })} /> Facility zones (1 km)</label>
              <strong>BASEMAP</strong>
              {BASEMAPS.map((b) => (
                <label key={b.id}><input type="radio" name="basemap" checked={basemap === b.id} onChange={() => setBasemap(b.id)} /> {b.label}</label>
              ))}
            </div>
          )}
          {notice && <div className="map-notice" role="status">{notice}</div>}
          <div className="map-legend">
            <strong>THERMAL EVENTS</strong>
            <div><span className="legend-dot critical" />Critical <span className="legend-dot high" />High <span className="legend-dot moderate" />Moderate <span className="legend-dot known" />Known source <span className="legend-dot facility" />Facility</div>
          </div>
          <div className="map-coordinates" ref={coordRef} />
        </>
      )}
    </div>
  );
}
