/**
 * DEMONSTRATION land-use layer. These are coarse circular zones for the demo region, NOT real land-cover data.
 * Phase 4 can replace this with OpenStreetMap / land-cover lookups behind the same `landContextAt` interface.
 */
export interface Anchor { lat: number; lon: number; region: string }

export const FARMLAND: Anchor[] = [
  { lat: 21.5, lon: 70.9, region: "Saurashtra" }, { lat: 20.1, lon: 74.2, region: "Nashik" },
  { lat: 20.9, lon: 78.6, region: "Vidarbha" }, { lat: 18.4, lon: 74.5, region: "Pune" },
];
export const FOREST: Anchor[] = [{ lat: 19.5, lon: 73.45, region: "Western Ghats" }, { lat: 20.3, lon: 79.7, region: "Vidarbha" }];

export const FARMLAND_RADIUS_KM = 25;
export const FOREST_RADIUS_KM = 15;
