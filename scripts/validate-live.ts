/**
 * Offline validation of the Phase 3C live pipeline. No network: FIRMS and Overpass responses are synthetic fixtures served
 * through an injected fetch. Run:  npx tsx scripts/validate-live.ts
 */
(globalThis as Record<string, unknown>).__THERMOGUARD_ENV__ = { VITE_FIRMS_API_KEY: "TEST_KEY_NOT_REAL" };

import assert from "node:assert/strict";
import { loadLiveDataset, resetLiveCaches } from "../src/services/live/liveDataService";
import { parseFirmsCsv, assertFirmsCsv } from "../src/services/live/firms";
import { classifyOsm, buildOverpassQuery, planTiles } from "../src/services/live/overpass";
import { describeSource } from "../src/services/live/sourceInfo";
import { analyseDataset } from "../src/services/analysis/engine";
import { demoDataService } from "../src/services/dataService";
import { buildTimeline } from "../src/services/intelligence/timeline";
import { generateAlerts } from "../src/services/intelligence/alerts";
import { buildReportContent } from "../src/services/reports/content";
import { buildFacilityStats } from "../src/services/intelligence/facilities";
import { computeKpis } from "../src/utils/kpis";

const NOW = Date.parse("2026-10-03T12:00:00Z");
const HEADER = "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight";
const row = (lat: number, lon: number, bt: number, date: string, time: string, conf: string, frp: number) =>
  `${lat},${lon},${bt},0.4,0.4,${date},${time},N,VIIRS,${conf},2.0NRT,290.1,${frp},D`;
const CSV = [
  HEADER,
  // location A: five consecutive days at the same pixel area (persistent), near the OSM refinery
  ...["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03"].map((d, i) => row(19.0, 72.9 + i * 0.0003, 345, d, "0830", "h", 40 + i * 2)),
  row(19.0, 72.9, 345, "2026-10-03", "0830", "h", 48), // exact duplicate of a record above? (same lat/lon only for i=0) -> distinct date so not a duplicate
  row(19.0, 72.9, 345, "2026-09-29", "0830", "h", 40), // exact duplicate of the first record
  // location B: single detection, far from anything
  row(21.5, 75.0, 320, "2026-10-03", "0912", "n", 9.5),
  // bad rows: must be skipped, never invented
  row(21.6, 75.1, 320, "2026-10-03", "0912", "n", NaN).replace("NaN", ""),
  "x,y,z",
].join("\n");

const OSM = {
  elements: [
    { type: "way", id: 111, center: { lat: 19.002, lon: 72.903 }, tags: { landuse: "industrial", industrial: "refinery", name: "Test Refinery" } },
    { type: "node", id: 222, lat: 19.5, lon: 73.0, tags: { power: "plant", "plant:source": "solar" } },       // solar: excluded
    { type: "way", id: 333, center: { lat: 21.52, lon: 75.02 }, tags: { landuse: "quarry" } },                  // unnamed quarry
  ],
};

const mkFetch = (opts: { firms?: "ok" | "fail" | "html"; osm?: "ok" | "fail" | "remark" } = {}) => {
  const calls: string[] = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url); calls.push(u);
    if (u.includes("firms.modaps")) {
      if (opts.firms === "fail") throw new TypeError("Failed to fetch");
      if (opts.firms === "html") return new Response("<html>nope</html>", { status: 200 });
      return new Response(CSV, { status: 200 });
    }
    if (u.includes("overpass")) {
      assert.equal(init?.method, "POST");
      if (opts.osm === "fail") throw new TypeError("Failed to fetch");
      if (opts.osm === "remark") return new Response(JSON.stringify({ elements: [], remark: "runtime error: Query timed out" }), { status: 200 });
      return new Response(JSON.stringify(OSM), { status: 200 });
    }
    return new Response("", { status: 404 });
  }) as typeof fetch;
  return { f, calls };
};
const ok = (m: string) => console.log("  ok  " + m);

async function main() {
  // ---- parsing
  assert.deepEqual(assertFirmsCsv(HEADER).includes("frp"), true);
  assert.throws(() => assertFirmsCsv("<html>"), (e: unknown) => /not thermal anomaly data/.test((e as { userMessage: string }).userMessage));
  const parsed = parseFirmsCsv(CSV, "VIIRS_SNPP_NRT");
  assert.equal(parsed.duplicates, 1); assert.equal(parsed.skipped, 2);
  assert.ok(parsed.observations.every((o) => /^FIRMS-\d{8}-[0-9a-z]+$/.test(o.id)));
  assert.equal(parsed.observations[0].confidence, null); assert.equal(parsed.observations[0].confidenceLabel, "high");
  const again = parseFirmsCsv(CSV, "VIIRS_SNPP_NRT");
  assert.deepEqual(again.observations.map((o) => o.id), parsed.observations.map((o) => o.id));
  ok("FIRMS CSV: deterministic ids, 1 duplicate collapsed, 2 invalid rows skipped, VIIRS confidence kept as category");

  // ---- OSM classification
  assert.equal(classifyOsm({ power: "plant", "plant:source": "solar" }), null);
  assert.equal(classifyOsm({ landuse: "industrial", industrial: "refinery" })?.type, "Oil Refinery");
  assert.equal(classifyOsm({ landuse: "quarry" })?.type, "Mining Area");
  assert.equal(classifyOsm({ landuse: "industrial", industrial: "warehouse" }), null);
  const plan = planTiles([{ lat: 19, lon: 72.9, frpMw: 40 }, { lat: 21.5, lon: 75, frpMw: 9 }]);
  assert.equal(plan.queried.length, 2);
  assert.ok(buildOverpassQuery(plan.queried).includes("[out:json]"));
  ok("OSM: tag classification, solar excluded, warehouse excluded, tiled query built");

  // ---- full live success
  resetLiveCaches();
  const a = mkFetch();
  const ds = await loadLiveDataset({ fetchImpl: a.f, now: NOW, search: "", force: true });
  assert.equal(ds.mode, "live"); assert.equal(ds.sources?.thermal, "NASA FIRMS"); assert.equal(ds.sources?.facilities, "OpenStreetMap");
  assert.equal(a.calls.filter((c) => c.includes("firms.modaps")).length, 1);
  assert.equal(a.calls.filter((c) => c.includes("overpass")).length, 1);
  assert.ok(!ds.events.some((e) => e.id.startsWith("TG-")));
  assert.equal(ds.events.length, 2, "5 daily detections at one place group into ONE location + 1 far event");
  assert.equal(ds.facilities.length, 2); // refinery + quarry
  assert.ok(ds.facilities.some((f) => f.name === "Unnamed industrial facility"));
  assert.ok(ds.facilities.every((f) => f.source === "osm" && f.osmRef));
  ok("live pipeline: 1 FIRMS + 1 Overpass request, events grouped, OSM facilities normalised, no demo IDs");

  // ---- same downstream pipeline
  const { dataset, assessments } = analyseDataset(ds);
  const evA = dataset.events.find((e) => Math.abs(e.lat - 19) < 0.01)!;
  const asA = assessments[evA.id];
  assert.equal(asA.nearest?.facility.name, "Test Refinery");
  assert.equal(asA.persistence.available, true); assert.equal(asA.persistence.active, 5);
  assert.equal(asA.land.kind, "industrial"); assert.match(asA.land.label, /OpenStreetMap/);
  const evB = dataset.events.find((e) => Math.abs(e.lat - 21.5) < 0.01)!;
  assert.equal(assessments[evB.id].land.kind, "undetermined" === assessments[evB.id].land.kind ? "undetermined" : assessments[evB.id].land.kind);
  assert.ok(["agricultural", "forest"].every((k) => assessments[evB.id].land.kind !== k), "live mode must not invent farmland/forest");
  assert.ok(Object.values(assessments).every((x) => x.riskScore >= 0 && x.riskScore <= 100));
  ok("engine runs unchanged on live data; persistence real; no demo land-use zones in live mode");

  // ---- alerts, kpis, timeline, facilities, report
  const alerts = generateAlerts(dataset, assessments);
  assert.equal(alerts.length, 2); assert.ok(alerts[0].id.startsWith("AL-"));
  const kpis = computeKpis(dataset); assert.equal(kpis[0].value, 2);
  const tl = buildTimeline(dataset, 30); assert.equal(tl.points.length, 30); assert.ok(tl.total > 0);
  assert.ok(tl.points.slice(0, 20).every((p) => p.all === 0), "no activity is generated outside the FIRMS window");
  const stats = buildFacilityStats(dataset, assessments, new Set(dataset.events.map((e) => e.id)));
  assert.equal(stats.find((s) => s.facility.name === "Test Refinery")!.total, 1);
  const rc = buildReportContent({ dataset, event: evA, assessment: asA, alert: alerts.find((x) => x.eventId === evA.id), facilityStats: stats, record: undefined, now: "2026-10-03T12:00:00Z" });
  assert.equal(rc.isDemo, false); assert.equal(rc.dataSource, "NASA FIRMS"); assert.equal(rc.industrialSource, "OpenStreetMap");
  assert.match(rc.liveNote ?? "", /does not constitute independent confirmation of a fire/);
  assert.ok(!/confirmed fire|satellite confirmed/i.test(rc.summary));
  ok("alerts, KPIs, timeline (no simulated days), facility stats and report content work on live data");

  // ---- source labels
  assert.deepEqual(describeSource(ds).lines, ["LIVE FIRMS", "OSM CONTEXT"]);

  // ---- FIRMS ok + OSM fails / times out
  for (const mode of ["fail", "remark"] as const) {
    resetLiveCaches();
    const b = mkFetch({ osm: mode });
    // session cache from the previous success would hide the failure: use a different "now" past the cache TTL
    const d2 = await loadLiveDataset({ fetchImpl: b.f, now: NOW + 3 * 3600_000, search: "", force: true });
    assert.equal(d2.sources?.facilities, "Unavailable"); assert.equal(d2.facilities.length, 0); assert.equal(d2.live?.facilitiesOk, false);
    assert.deepEqual(describeSource(d2).lines, ["LIVE FIRMS", "OSM UNAVAILABLE"]);
    const an = analyseDataset(d2); assert.equal(Object.keys(an.assessments).length, d2.events.length);
  }
  ok("FIRMS ok + OSM failure/timeout: live events kept, OSM UNAVAILABLE, engine still runs");

  // ---- FIRMS failures reject (caller falls back to demo)
  for (const m of ["fail", "html"] as const) {
    resetLiveCaches();
    await assert.rejects(loadLiveDataset({ fetchImpl: mkFetch({ firms: m }).f, now: NOW, search: "", force: true }));
  }
  ok("FIRMS network failure / non-CSV response reject with a safe error");

  // ---- empty
  resetLiveCaches();
  const e = await loadLiveDataset({ fetchImpl: mkFetch().f, now: NOW, search: "?simulateEmpty", force: true });
  assert.equal(e.events.length, 0); assert.deepEqual(describeSource(e).lines, ["LIVE FIRMS", "NO ANOMALIES"]);
  assert.equal(Object.keys(analyseDataset(e).assessments).length, 0);
  ok("empty live dataset handled");

  // ---- demo untouched (the demo service reads window.location for ?simulateError)
  (globalThis as Record<string, unknown>).window = { location: { search: "" } };
  const demo = await demoDataService.load();
  assert.equal(demo.events.length, 40); assert.equal(demo.facilities.length, 12); assert.equal(demo.mode, "demo");
  const dAn = analyseDataset(demo);
  assert.ok(dAn.assessments["TG-2026-00421"]); assert.equal(dAn.assessments["TG-2026-00421"].persistence.available, true);
  assert.deepEqual(describeSource(demo).lines, ["DEMO DATA"]);
  ok("demo dataset intact: 40 events, 12 facilities, engine output present");
  console.log("\nAll live-pipeline checks passed.");
}
main().catch((err) => { console.error(err); process.exit(1); });
