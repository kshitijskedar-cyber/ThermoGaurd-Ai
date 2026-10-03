import type { ThermalDataset } from "@/types";
import { demoEvents, DEMO_REFERENCE_TIME } from "@/data/demo/events";
import { demoFacilities } from "@/data/demo/facilities";
import { generateDemoHistory } from "@/data/demo/history";
import { resolveRequestedMode } from "@/services/live/config";
import { LiveSourceError, isAbort } from "@/services/live/errors";
import { loadLiveDataset } from "@/services/live/liveDataService";

export interface LoadOptions {
  /** Bypass short-lived caches (manual Refresh). */
  force?: boolean;
  signal?: AbortSignal;
}

/** Data-layer contract. The UI only ever sees a ThermalDataset, whether it came from the demo generator or from NASA FIRMS + OSM. */
export interface DataService { load(opts?: LoadOptions): Promise<ThermalDataset> }

export const DEMO_SOURCES = { thermal: "Demo", facilities: "Demo", history: "Demo" } as const;

export const demoDataService: DataService = {
  async load() {
    await new Promise((r) => setTimeout(r, 450)); // lets the loading state be seen
    if (new URLSearchParams(window.location.search).has("simulateError")) throw new Error("Simulated data failure");
    return {
      mode: "demo", sourceLabel: "Demonstration dataset (simulated)", referenceTime: DEMO_REFERENCE_TIME,
      events: demoEvents, facilities: demoFacilities, history: generateDemoHistory(demoEvents),
      sources: { ...DEMO_SOURCES }, historyWindowDays: 10,
    };
  },
};

/** NASA FIRMS thermal anomalies + OpenStreetMap context. Throws LiveSourceError when FIRMS cannot be loaded. */
export const liveDataService: DataService = {
  load: (opts) => loadLiveDataset({ force: opts?.force, signal: opts?.signal }),
};

/**
 * Chooses the source and applies the fallback policy:
 *   demo requested                       -> demo dataset
 *   live requested, FIRMS ok             -> live dataset (OSM may be unavailable; the dataset says so)
 *   live requested, FIRMS fails / absent -> demo dataset flagged as a FALLBACK, never presented as live
 */
export const autoDataService: DataService = {
  async load(opts) {
    if (resolveRequestedMode(window.location.search) === "demo") return demoDataService.load(opts);
    try {
      return await liveDataService.load(opts);
    } catch (e) {
      if (isAbort(e)) throw e;
      const message = e instanceof LiveSourceError ? e.userMessage : "NASA FIRMS data could not be loaded.";
      if (!(e instanceof LiveSourceError)) console.warn("[ThermoGuard] Unexpected live-data failure:", e);
      const demo = await demoDataService.load(opts);
      return {
        ...demo,
        live: { requested: "live", thermalOk: false, facilitiesOk: null, fetchedAt: null, messages: [message, "Showing controlled demonstration data."] },
      };
    }
  },
};

export const activeDataService: DataService = autoDataService;
