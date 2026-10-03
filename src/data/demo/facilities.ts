import type { Facility } from "@/types";

/** DEMONSTRATION facilities. Names are fictional; locations are placed in plausible industrial regions of Western India. */
export const demoFacilities: Facility[] = [
  { id: "FAC-01", name: "Saurashtra Coast Refinery", type: "Oil Refinery", lat: 22.38, lon: 69.82, region: "Saurashtra" },
  { id: "FAC-02", name: "Gulf of Khambhat Petrochemical Plant", type: "Petrochemical Plant", lat: 21.1, lon: 72.65, region: "South Gujarat" },
  { id: "FAC-03", name: "Bharuch Estuary LNG Terminal", type: "LNG Terminal", lat: 21.72, lon: 72.52, region: "South Gujarat" },
  { id: "FAC-04", name: "Patalganga Chemical Complex", type: "Petrochemical Plant", lat: 18.88, lon: 73.18, region: "Raigad" },
  { id: "FAC-05", name: "Navi Mumbai Refinery Unit", type: "Oil Refinery", lat: 19.07, lon: 73.04, region: "Mumbai Metropolitan" },
  { id: "FAC-06", name: "Mumbai Harbour Thermal Power Plant", type: "Thermal Power Plant", lat: 19.02, lon: 72.9, region: "Mumbai Metropolitan" },
  { id: "FAC-07", name: "Pune Industrial Belt Steel Plant", type: "Steel Plant", lat: 18.62, lon: 73.85, region: "Pune" },
  { id: "FAC-08", name: "Nashik Thermal Power Station", type: "Thermal Power Plant", lat: 20.02, lon: 73.78, region: "Nashik" },
  { id: "FAC-09", name: "Vidarbha Steel Works", type: "Steel Plant", lat: 21.15, lon: 79.09, region: "Vidarbha" },
  { id: "FAC-10", name: "Chandrapur Open-cast Coal Area", type: "Mining Area", lat: 19.96, lon: 79.3, region: "Vidarbha" },
  { id: "FAC-11", name: "Wani Coal Mining Area", type: "Mining Area", lat: 20.05, lon: 78.95, region: "Vidarbha" },
  { id: "FAC-12", name: "Ratnagiri Coastal LNG Terminal", type: "LNG Terminal", lat: 17.58, lon: 73.17, region: "Ratnagiri" },
];
