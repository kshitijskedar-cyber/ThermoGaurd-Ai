# ThermoGuard AI

AI-assisted industrial thermal intelligence: an SIH prototype and decision-support tool. Built on React 19, Vite, TypeScript, Tailwind v4 and MapLibre GL.

## Status: Phase 3C — Live NASA FIRMS + OpenStreetMap Integration
Phase 1 is unchanged: routing, the real MapLibre map (clustering, popups, layers, basemaps), the demonstration dataset (40 events, 12 facilities), dynamic KPIs, and loading/error/empty states.

**Phase 2 adds**
- **AI-Assisted Geospatial Classification** (`src/services/analysis/engine.ts`): a transparent rule-based prototype. It uses FRP, brightness temperature, persistence, distance to the nearest facility, facility type, history and demo land-use context. **There is no trained ML or deep-learning model.** Confidence is a rule-agreement score, not a model probability.
- **Prototype Risk Score** (0-100): thermal intensity 35%, industrial proximity 25%, persistence 20%, historical anomaly 20%. Bands: 0-30 LOW, 31-60 MODERATE, 61-80 HIGH, 81-100 CRITICAL.
- **AI Investigation** (`/investigation?event=ID`): assessment, classification with candidate fit, risk meter, "Why this event was flagged" (only factors at or above 50%), contributing factors, persistence timeline, nearest-facility context and a step rail for the guided flow.
- **History** (`/history`) and a first **Report preview** (extended in Phase 3B below).
- Dashboard classification, risk, KPIs and map colours now come from the engine.

Still simulated: observation history (`src/data/demo/history.ts`), land-use zones (`src/data/demo/landuse.ts`), all events and facilities. Facility operating status is not in the dataset, so zone membership (1 km) is shown instead.



**Phase 3A adds** (Phases 1 and 2 are unchanged)
- **Alerts & Incident Center** (`/alerts`): one alert per thermal event, priority taken from the Phase 2 risk level (CRITICAL = Critical Alert, HIGH = High Priority, MODERATE = Monitoring, LOW = Informational). Status NEW / INVESTIGATING / RESOLVED can be changed per alert (kept in this browser's localStorage, with a change log). Search, filters (risk, status, classification), sort (newest, highest risk), clear filters. KPIs are calculated from the alerts. The alert detail sheet links to AI Investigation, Event History, the map and the facility; it does not re-implement the investigation. The dashboard has a Priority Alerts strip, and the sidebar badge counts open critical and high alerts.
- **Industrial Sites** (`/sites`, `/sites/:facilityId`): searchable facility list (filter by type and risk, sort by risk or event count) and a Facility Intelligence view with KPIs, related thermal events (open the AI Investigation), an activity trend, persistence summary and the existing MapWorkspace/ThermalMap component showing the facility and its events.
- **Analytics** (`/analytics`): events over time (7/30/90 days), risk distribution, classification distribution (four operational groups, engine classes shown underneath), industrial correlation (within 1 km / 1 to 5 km / beyond 5 km), persistent hotspots (facilities with 2 or more related events) and "AI-Assisted Insights". Insights are plain rules computed from the data; **no trained model produces them**.
- Architecture: pure functions in `src/services/intelligence/` (alerts, facilities, analytics, persistence, timeline), a swappable demo repository for per-day activity in `src/data/demo/dailyActivity.ts`, state in `useAlerts` / `useFacilityStats`, and filters kept in the URL (`useUrlFilters`) so Analytics and Dashboard can deep-link into filtered views.

The 7/30/90-day history is simulated and deterministic (seeded from event id and calendar day), so it is identical on every refresh and is labelled DEMO DATA.

**Intentionally not in Phase 3A:** live NASA FIRMS and OpenStreetMap/Overpass data (later phase), authentication, backend, trained ML model.

**Phase 3B adds** (Phases 1, 2 and 3A are unchanged)

- **Investigation Reports** (`/reports`): KPIs calculated from the saved reports (Total, Critical, High-Risk, Generated Recently = last 24 h), a "Generate an Investigation Report" picker and the **Report History** list (Report ID, Event ID, generated time, location, classification, risk score and level, status, actions).
- **Report Preview** (`/reports?event=ID`): a nine-section "Thermal Event Investigation Report": Event Overview, Map / Geospatial Context, AI-Assisted Geospatial Classification, Why This Event Was Flagged, Risk Assessment, Persistence Analysis, Industrial Context, Investigation Summary and Prototype Decision Support. Responsive on desktop, tablet and mobile.
- **PDF Export**: "Export PDF" downloads a structured, text-based A4 PDF (3 pages, margins, running header, page numbers, DEMO DATA footer on every page). It is **not** a screenshot of the browser UI.
- **Evidence Summary**: "Why this event was flagged" lists only the factors the engine found at or above its 50% threshold; the summary paragraph is assembled from the event's own values and uses wording such as "classified as" and "detected anomaly", never "confirmed fire".
- **Alert-to-Report workflow**: Alerts, open alert, GENERATE REPORT (or AI INVESTIGATE, then GENERATE REPORT), preview, Export PDF. The report shows the alert ID and alert status as "Investigation status".
- **Facility-to-Report workflow**: Industrial Sites, Facility Intelligence, select a thermal event, AI Investigation, GENERATE REPORT, Export PDF. Analytics, Persistent Hotspots, facility and event reach the same flow. The dashboard event panel has the same button.
- **Report statuses**: DRAFT (saved from an unsaved preview), GENERATED, EXPORTED. Regenerating updates the timestamp and sets the status back to GENERATED. One report per event; the ID follows the event (TG-2026-00421 gives RPT-00421).

How data stays consistent: `src/services/reports/content.ts` is a pure function that **assembles** a `ReportContent` from the existing Phase 2 assessment, the Phase 3A alert and facility statistics. It does not recalculate risk, classification or persistence. The preview (`ReportDocument`) and the PDF (`services/reports/pdf.ts`) both render that same object. Only a small record (ID, event ID, timestamps, status, revision) is stored in this browser's localStorage; report content is always rebuilt from the live assessment, so it cannot drift from the dashboard, map, alerts or analytics.

Map in reports: a schematic plot built from the event and facility coordinates (north up, 1 km facility zones, scale bar), drawn from the same geometry on screen and in the PDF. No basemap or satellite imagery is embedded or invented. The on-screen preview also offers the Phase 2 interactive MapLibre map (screen only; needs internet for tiles).

PDF technology: **jsPDF** (the only dependency added), loaded on demand with a dynamic import so it is fetched only when someone exports. Text is drawn as real PDF text and shapes with jsPDF primitives. No html2canvas or screenshot is used by this code. The built-in PDF fonts (Helvetica, Courier) are used, so characters outside Latin-1 are replaced with plain equivalents.

Edge cases handled: no reports yet, no event selected or unknown event ID, no facility in the dataset, missing observation history, blocked localStorage, PDF generation failure (inline error with retry).

Limitations: reports are stored per browser (no backend or sharing); the interactive map is not embedded in the PDF; PDF fonts are the standard Helvetica/Courier rather than Inter/IBM Plex Mono; the "Generated Recently" KPI uses the real clock while the dataset snapshot is fixed demo time.

**Intentionally not in Phase 3B:** live NASA FIRMS and OSM/Overpass data (added in Phase 3C below), real-time streaming, authentication, cloud backend, trained ML model.

## Phase 3C — Live NASA FIRMS + OpenStreetMap Integration

Phases 1–3B are unchanged. Phase 3C adds a **live implementation behind the existing `DataService` interface**. The UI keeps calling `useThermalData()` and does not know whether the data is demo or live; **live and demo data share the same downstream pipeline** (analysis engine, alerts, analytics, sites, investigation, reports, PDF, map).

### What the data means (read this first)
| Layer | What it is |
|---|---|
| **NASA FIRMS** | Satellite-observed **thermal anomalies** (VIIRS / MODIS hot pixels). **A thermal anomaly is not a confirmed fire**, and certainly not a confirmed industrial fire. |
| **ThermoGuard AI** | **AI-assisted geospatial classification and risk scoring**: the same transparent, **rule-based** prototype as before. **There is no trained ML or deep-learning model.** Output is decision support, never confirmation. |
| **OpenStreetMap / Overpass** | Volunteer-mapped infrastructure **context** (industrial land use, works, power plants, quarries). An OSM object is not proof of an operating facility; coverage is uneven; operating status is not available and never invented. |
| **Result** | A **prototype assessment**. The wording "potential industrial fire", "thermal anomaly" and "decision-support assessment" is used; "confirmed fire" is not. |

### Architecture
```
NASA FIRMS (CSV) -> services/live/firms.ts        parse, validate, deterministic IDs, de-duplicate
                 -> services/live/firmsEvents.ts   group repeat pixels into locations, build the FIRMS-window history
                 -> services/live/overpass.ts      ONE batched Overpass query (tiled around the events), cached
                 -> services/live/liveDataService  ThermalDataset { mode: "live", sources, live }
                 -> analyseDataset() (unchanged engine)  -> EventAssessment[]
                 -> Dashboard / Map / Alerts / Analytics / Sites / Investigation / Reports / PDF
Demo dataset     -> ThermalDataset { mode: "demo" }      -> the same analyseDataset() and UI
```
`src/services/dataService.ts` picks the source and applies the fallback policy. `src/services/live/sourceInfo.ts` is the single place that words the source status, so every screen says the same thing.

### Run
```bash
npm install
npm run dev          # no configuration: demo dataset (40 events, 12 facilities), exactly as in Phase 3B
```
**Live mode** needs a free FIRMS MAP_KEY (https://firms.modaps.eosdis.nasa.gov/api/area/). Copy `.env.example` to `.env` and choose one option:

- **A. Key in the browser:** `VITE_FIRMS_API_KEY=your_key`. Simplest, but any `VITE_*` value is embedded in the built JavaScript. Fine for a local prototype; do not publish a build containing a key you care about.
- **B. Key kept server-side (recommended):** `FIRMS_MAP_KEY=your_key` and `VITE_FIRMS_BASE_URL=/api/firms`. The Vite dev/preview server then proxies `/api/firms` to NASA and adds the key itself (see `vite.config.ts`). Use this if the browser blocks direct FIRMS calls (CORS). It is a dev/preview proxy, not a production backend.

Then `npm run dev`. Add `?mode=demo` to the URL to force the demo dataset, or `?mode=live` to force a live attempt.

| Variable | Needed? | Meaning |
|---|---|---|
| `VITE_FIRMS_API_KEY` (alias `VITE_FIRMS_MAP_KEY`) | Option A only | FIRMS MAP_KEY in the browser |
| `FIRMS_MAP_KEY` + `VITE_FIRMS_BASE_URL` | Option B only | Server-side key + proxy path |
| `VITE_FIRMS_BBOX` | optional | `west,south,east,north`; default Western / Central India `68,15.5,81,25` |
| `VITE_FIRMS_REGION_LABEL` | optional | Label for the area |
| `VITE_FIRMS_SOURCE` | optional | Default `VIIRS_SNPP_NRT` |
| `VITE_FIRMS_DAY_RANGE` | optional | 1–5 days (FIRMS limit); default 5 |
| `VITE_OVERPASS_URL` | optional | Default `https://overpass-api.de/api/interpreter` |
| `VITE_DATA_MODE` | optional | `demo` or `live`; default is live only when FIRMS is configured |

Never commit `.env` (it is git-ignored). No key is hard-coded anywhere; `.env.example` contains no secret.

### Live / demo behaviour and fallback
The header, a banner on every page, the sidebar and the panel tags state which data is active:

| State | Header shows |
|---|---|
| Demo (default) | `DEMO DATA` · Controlled Demonstration Dataset |
| FIRMS + OSM succeed | `LIVE FIRMS · OSM CONTEXT` · Updated HH:MM IST |
| FIRMS succeeds, OSM fails | `LIVE FIRMS · OSM UNAVAILABLE` |
| FIRMS returns nothing | `LIVE FIRMS · NO ANOMALIES` (empty state with Refresh) |
| FIRMS fails / key missing / blocked | `LIVE DATA UNAVAILABLE · DEMO FALLBACK` (the demo dataset, never presented as live) |

Failures covered: no internet, blocked request or CORS, HTTP errors, rate limits (429), invalid key, non-CSV responses, Overpass timeouts (including HTTP 200 with a timeout remark). Messages are professional and short ("NASA FIRMS data could not be loaded.", "OpenStreetMap context could not be loaded.", "Showing controlled demonstration data."); technical detail goes to the browser console, keys are redacted in logs.

**Refresh**: the refresh button in the header (visible when live data was requested) reloads FIRMS, recomputes the analysis and updates every page without reloading the browser. Only one request runs at a time; the FIRMS response is cached for 5 minutes (Refresh bypasses it) and the OSM result for 30 minutes (in memory and `sessionStorage`). There is no polling.

### How FIRMS records become events
- Fields mapped: latitude, longitude, `acq_date` + `acq_time` (UTC, shown in IST), satellite, instrument, FRP, brightness (`bright_ti4` for VIIRS, `brightness` for MODIS) and confidence. Rows missing a required field are **skipped, not invented**.
- **Confidence**: VIIRS reports low / nominal / high, not a percentage. The UI shows that category; MODIS percentages are shown as percentages. For the rule-agreement score only, the category maps to fixed ordinal weights (documented in `engine.ts`).
- **IDs** are deterministic (`FIRMS-YYYYMMDD-<hash>`) so a refresh yields the same ID for the same observation; alert and report IDs derive from it (`AL-…`, `RPT-…`).
- **De-duplication** removes only exact repeats (same position to ~11 m, time, satellite, instrument). Nearby distinct pixels are kept.
- **Locations**: repeat detections within 1 km are grouped into one location so persistence can be measured; each event is a real FIRMS record (the latest detection at that place).
- **Region** is a 0.5° grid cell: FIRMS carries no place names and no reverse geocoder is used.

### OSM / Overpass
One POST containing a union of small boxes (0.25° tiles, padded ~6.7 km) built from where the events actually are; never one query per event and never a continent-sized query. At most 48 tiles are queried (busiest first); the UI says if areas were skipped. Features: `landuse=industrial`, `industrial=*`, `man_made=works`, `power=plant` (solar, wind and hydro are excluded), `landuse=quarry`. Warehouses/logistics are ignored. Each facility keeps its OSM reference and the tag that produced its type; unnamed objects are labelled "Unnamed industrial facility".

### Persistence and land-use limits (important)
- FIRMS is not a multi-week archive in this prototype. The history of a live event is **only the days inside the fetched FIRMS window (at most 5)**. A day without a detection can mean no heat **or** no usable overpass (cloud). Nothing is simulated. If a location has fewer than 3 observation days in the window, persistence is shown as **"Historical persistence unavailable for this live observation"** and the rule engine uses a neutral value instead of a made-up one. Analytics ranges beyond the window show no earlier data.
- **Land context**: the demo farmland and forest zones are demo-only. In live mode land context comes only from OSM industrial/mining objects; otherwise it is "Land cover not determined". As a consequence the rule layer in live mode has no land-cover evidence for agricultural burning or wildfire, so those classes are less likely to be selected and more events can end up **Unknown**. This is a known limitation, not a bug.
- Industrial-fire fit relies partly on a spike against a historical baseline. With at most 5 days of history the baseline is often missing; the engine then uses a neutral value.

### What is unchanged
The risk score, its weights (thermal 35%, proximity 25%, persistence 20%, historical anomaly 20%) and bands, the classification rules, alert priorities, analytics grouping, report structure and PDF generator are the Phase 2–3B logic. Only the minimum changes for unavailable history and missing percentage confidence were added.

### Validation
```bash
npm run typecheck
npm run build
npx tsx scripts/validate-live.ts     # offline: fixtures for FIRMS CSV and Overpass JSON, no network
```
`scripts/validate-live.ts` exercises parsing, IDs, de-duplication, grouping, OSM tagging, the single FIRMS and single Overpass request, FIRMS failure, OSM failure/timeout, empty results, the unchanged engine, alerts, KPIs, timeline, facility statistics, report content and the intact demo dataset. Test failure paths in the browser with `?mode=live&simulateFirmsError`, `&simulateOsmError` and `&simulateEmpty` (and `?simulateError` for the original demo error state).

### CURRENTLY IMPLEMENTED
Everything in Phases 1–3B, plus: live FIRMS client and normalisation, OSM/Overpass client and tag classification, configurable area, source-aware UI (header chip, banners, tags, popups), manual Refresh with caching and de-duplicated requests, demo fallback, live-aware alerts/analytics/sites/investigation/reports/PDF, the optional server-side-key dev proxy.

### FUTURE ENHANCEMENTS (not implemented)
A production backend/proxy and scheduled ingestion; a multi-week FIRMS archive for genuine persistence baselines; satellite or OSM-based land-cover for agricultural/forest evidence; a trained and validated model (none exists today); authentication and shared report storage; reverse geocoding for place names; facility operating status from an authoritative source.

### Honest limitations
The live path was built and validated against fixtures and the documented FIRMS and Overpass interfaces. Whether a given FIRMS endpoint allows direct browser calls (CORS) depends on NASA's current server configuration; use Option B if it does not. OSM public servers are for light use and may rate-limit. FIRMS near-real-time data can lag the overpass by hours.

**Demo data remains simulated and labelled DEMO DATA. It is not live satellite data.** Demo facility names are fictional. Live facility names come from OpenStreetMap.

## Run
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-checks, then builds to dist/
npm run preview
```
Open `/?simulateError` to see the error state. The basemaps (OpenStreetMap, Esri World Imagery, CARTO Dark) need internet access and no API key; if tiles fail, a notice appears and the data layers still work. Heavy production use should switch to a tile provider that permits it (OSM's public tile servers are for light use).

## Structure
```
src/
  components/  common/ layout/ Map/ Events/ Dashboard/
  pages/       Overview, Thermal Map, Investigation, History, Reports (history + preview), Alerts, Sites, Analytics
  services/analysis/  engine.ts (classification + risk), landContext.ts
  services/reports/  content.ts (assembles report), mapGeometry.ts, pdf.ts (jsPDF), summary.ts
  components/Reports/  ReportHistory, ReportPreview, ReportDocument, ReportMapPanel
  hooks/       useReports (records), useReportBuilder (build, open, export)
  services/    dataService.ts (demo / live / fallback), live/ (firms, firmsEvents, overpass, liveDataService, sourceInfo, config), geospatial/geo.ts
  data/demo/   facilities.ts, events.ts (seeded generator)
  hooks/       useThermalData (data + selected-event state)
  utils/       format.ts, kpis.ts
  types/
```
The data layer returns a `ThermalDataset` through the `DataService` interface; `services/live/` is the live implementation (Phase 3C) behind it.
