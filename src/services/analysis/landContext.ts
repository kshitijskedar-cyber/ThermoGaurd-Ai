import type { Facility, LandContext } from "@/types";
import { FARMLAND, FARMLAND_RADIUS_KM, FOREST, FOREST_RADIUS_KM } from "@/data/demo/landuse";
import { haversineKm } from "@/services/geospatial/geo";

const INDUSTRIAL_RADIUS_KM = 2;
const MINING_RADIUS_KM = 3.5;

/**
 * Coarse land-use context.
 *  - demo: the facility dataset plus the simulated land-use zones in src/data/demo/landuse.ts.
 *  - live: ONLY OpenStreetMap-derived industrial / mining context around the nearest mapped facility. There is no satellite
 *    land-cover layer in this prototype, so agricultural and forest land are reported as undetermined, never guessed.
 */
export function landContextAt(lat: number, lon: number, nearest: { facility: Facility; km: number } | null, mode: "demo" | "live" = "demo"): LandContext {
  if (mode === "live") {
    if (nearest) {
      const mining = nearest.facility.type === "Mining Area";
      if (nearest.km <= (mining ? MINING_RADIUS_KM : INDUSTRIAL_RADIUS_KM))
        return {
          kind: mining ? "mining" : "industrial", label: mining ? "Mining land-use (OpenStreetMap)" : "Industrial land-use (OpenStreetMap)",
          detail: `${nearest.km.toFixed(2)} km from an OpenStreetMap ${nearest.facility.type.toLowerCase()} object (${nearest.facility.name})`,
        };
    }
    return { kind: "undetermined", label: "Land cover not determined", detail: "No mapped industrial object nearby in OpenStreetMap; no satellite land-cover layer is used in live mode" };
  }
  if (nearest) {
    const mining = nearest.facility.type === "Mining Area";
    if (nearest.km <= (mining ? MINING_RADIUS_KM : INDUSTRIAL_RADIUS_KM))
      return {
        kind: mining ? "mining" : "industrial", label: mining ? "Mining land-use" : "Industrial land-use",
        detail: `${nearest.km.toFixed(2)} km from ${nearest.facility.type.toLowerCase()} (${nearest.facility.name})`,
      };
  }
  const nearZone = (zones: typeof FARMLAND, radius: number) =>
    zones.map((z) => ({ z, km: haversineKm(lat, lon, z.lat, z.lon) })).filter((x) => x.km <= radius).sort((a, b) => a.km - b.km)[0];
  const farm = nearZone(FARMLAND, FARMLAND_RADIUS_KM);
  const forest = nearZone(FOREST, FOREST_RADIUS_KM);
  if (forest && (!farm || forest.km / FOREST_RADIUS_KM < farm.km / FARMLAND_RADIUS_KM))
    return { kind: "forest", label: "Forest / vegetated land", detail: `Within the ${forest.z.region} forest zone (demo land-use layer)` };
  if (farm) return { kind: "agricultural", label: "Agricultural land", detail: `Within the ${farm.z.region} farmland zone (demo land-use layer)` };
  return { kind: "undetermined", label: "Undetermined land-use", detail: "No industrial, agricultural or forest zone matched" };
}
