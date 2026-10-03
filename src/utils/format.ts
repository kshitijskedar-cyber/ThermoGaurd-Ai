import type { Classification, RiskLevel, ThermalEvent } from "@/types";

export const CLASS_LABEL: Record<Classification, string> = {
  industrial_fire: "Possible Industrial Fire",
  gas_flare: "Gas Flare",
  persistent_heat: "Persistent Industrial Heat",
  agri_burning: "Agricultural Burning",
  wildfire: "Possible Wildfire",
  mining: "Mining Activity",
  unknown: "Unknown Thermal Anomaly",
};

export const RISK_LABEL: Record<RiskLevel, string> = { critical: "CRITICAL", high: "HIGH", moderate: "MODERATE", low: "LOW" };
export const RISK_RANK: Record<RiskLevel, number> = { critical: 4, high: 3, moderate: 2, low: 1 };

export type Tone = "critical" | "high" | "moderate" | "known";

/** Visual tone used on the map and legend. Known persistent sources are shown separately from risk-ranked events. */
export function eventTone(e: ThermalEvent): Tone {
  if (e.classification === "persistent_heat") return "known";
  if (e.risk === "low") return "moderate";
  return e.risk;
}

const TONE_DOT: Record<Tone, string> = { critical: "red", high: "orange", moderate: "amber", known: "blue" };
export const toneDot = (t: Tone) => TONE_DOT[t];

const dtf = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
});

export function formatIST(iso: string): string {
  const p = Object.fromEntries(dtf.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute} IST`;
}
export const formatTimeIST = (iso: string) => formatIST(iso).split(", ")[1];
export const formatShortIST = (iso: string) => formatIST(iso).replace(/ \d{4}/, "");

export function formatCoord(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? "E" : "W"}`;
}

export const RISK_BANDS: { level: RiskLevel; label: string; range: string; min: number; max: number }[] = [
  { level: "low", label: "LOW", range: "0–30", min: 0, max: 30 },
  { level: "moderate", label: "MODERATE", range: "31–60", min: 31, max: 60 },
  { level: "high", label: "HIGH", range: "61–80", min: 61, max: 80 },
  { level: "critical", label: "CRITICAL", range: "81–100", min: 81, max: 100 },
];
export const formatDay = (iso: string) => {
  const p = Object.fromEntries(dtf.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day} ${p.month}`;
};

/** Sensor detection confidence as shown to people: a percentage (MODIS, demo), the FIRMS category (VIIRS), or n/a. Never a made-up percentage. */
export function formatSensorConfidence(e: Pick<ThermalEvent, "confidence" | "confidenceLabel">): string {
  if (e.confidence != null) return `${e.confidence}%`;
  if (e.confidenceLabel) return `${e.confidenceLabel.charAt(0).toUpperCase()}${e.confidenceLabel.slice(1)}`;
  return "n/a";
}
