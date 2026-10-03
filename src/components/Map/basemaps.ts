import type { StyleSpecification } from "maplibre-gl";

export type BasemapId = "streets" | "satellite" | "dark";

export const BASEMAPS: { id: BasemapId; label: string; source: string }[] = [
  { id: "streets", label: "Streets", source: "bm-streets" },
  { id: "satellite", label: "Satellite", source: "bm-satellite" },
  { id: "dark", label: "Dark", source: "bm-dark" },
];

export const BASEMAP_SOURCE_IDS = BASEMAPS.map((b) => b.source);

/** All basemaps live in the style; switching only toggles visibility, so data layers survive a switch. No API key required. */
export function buildStyle(initial: BasemapId = "streets"): StyleSpecification {
  return {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      "bm-streets": { type: "raster", tileSize: 256, maxzoom: 19, tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], attribution: "© OpenStreetMap contributors" },
      "bm-satellite": { type: "raster", tileSize: 256, maxzoom: 18, tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], attribution: "Imagery © Esri, Maxar, Earthstar Geographics" },
      "bm-dark": { type: "raster", tileSize: 256, maxzoom: 19, tiles: ["https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"], attribution: "© OpenStreetMap contributors © CARTO" },
    },
    layers: BASEMAPS.map((b) => ({
      id: b.source, type: "raster", source: b.source,
      layout: { visibility: b.id === initial ? "visible" : "none" },
    })),
  };
}
