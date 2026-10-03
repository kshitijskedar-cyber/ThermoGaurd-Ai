import type { jsPDF as JsPDF } from "jspdf";
import type { RiskLevel } from "@/types";
import type { ReportContent } from "@/types/reports";
import { RISK_BANDS, RISK_LABEL, formatDay, formatIST } from "@/utils/format";
import { DEMO_DISCLAIMER, DEMO_DISCLAIMER_LONG, LIVE_BANNER_TITLE, METHOD_NOTE, REPORT_STATUS_LABEL, days } from "./content";
import { makeProjector } from "./mapGeometry";

type RGB = [number, number, number];
const C = {
  navy: [17, 30, 44] as RGB, blue: [46, 100, 143] as RGB, ink: [23, 33, 43] as RGB, muted: [101, 115, 131] as RGB,
  line: [219, 225, 230] as RGB, soft: [244, 246, 247] as RGB, white: [255, 255, 255] as RGB,
  amber: [196, 138, 37] as RGB, amberSoft: [251, 242, 223] as RGB, amberInk: [122, 84, 16] as RGB,
  green: [49, 130, 103] as RGB, orange: [210, 105, 47] as RGB, red: [189, 63, 58] as RGB,
};
const RISK_RGB: Record<RiskLevel, RGB> = { low: C.green, moderate: C.amber, high: C.orange, critical: C.red };

const PW = 210, PH = 297, M = 16, CW = PW - 2 * M, TOP = 22, BOTTOM = 20;

/** Standard PDF fonts only cover Latin-1/WinAnsi, so anything else is replaced by a readable equivalent. */
function clean(s: string): string {
  return s
    .replace(/[≥]/g, ">=").replace(/[≤]/g, "<=").replace(/→/g, "to").replace(/Σ/g, "Sum").replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-").replace(/…/g, "...").replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "");
}

export async function buildReportPdf(c: ReportContent): Promise<JsPDF> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  doc.setProperties({
    title: `Thermal Event Investigation Report ${c.reportId}`, subject: `Event ${c.eventId}`, author: "ThermoGuard AI",
    keywords: c.isDemo ? "demonstration data, thermal event, investigation report" : "NASA FIRMS, OpenStreetMap, thermal anomaly, investigation report, prototype assessment", creator: "ThermoGuard AI",
  });
  let y = TOP;

  const fill = (col: RGB) => doc.setFillColor(col[0], col[1], col[2]);
  const stroke = (col: RGB) => doc.setDrawColor(col[0], col[1], col[2]);
  const ink = (col: RGB) => doc.setTextColor(col[0], col[1], col[2]);
  const font = (style: "normal" | "bold", size: number, family: "helvetica" | "courier" = "helvetica") => { doc.setFont(family, style); doc.setFontSize(size); };
  const text = (s: string, x: number, yy: number, o?: { align?: "left" | "right" | "center"; maxWidth?: number }) => doc.text(clean(s), x, yy, o);
  /** Wraps text measured at the size/style it will be drawn in (measuring at another size makes lines overflow). */
  const lines = (s: string, w: number, size?: number, style: "normal" | "bold" = "normal"): string[] => {
    if (size) font(style, size);
    return doc.splitTextToSize(clean(s), w) as string[];
  };
  const need = (h: number) => { if (y + h > PH - BOTTOM) { doc.addPage(); y = TOP; } };

  // ---------- Cover block (page 1 only)
  fill(C.navy); doc.rect(0, 0, PW, 40, "F");
  fill(C.blue); doc.rect(0, 40, PW, 1.2, "F");
  ink(C.white); font("bold", 9.5); text("THERMOGUARD AI", M, 13);
  ink([160, 185, 205]); font("normal", 7.5); text("AI-Powered Industrial Thermal Intelligence", M, 18);
  ink(C.white); font("bold", 17); text("THERMAL EVENT INVESTIGATION REPORT", M, 29);
  ink([160, 185, 205]); font("normal", 8); text(`${c.reportId}  |  ${c.eventId}`, M, 35.5);
  // risk chip top-right
  fill(RISK_RGB[c.riskLevel]); doc.roundedRect(PW - M - 46, 9, 46, 10, 1, 1, "F");
  ink(C.white); font("bold", 9); text(`${RISK_LABEL[c.riskLevel]}  ${c.riskScore}/100`, PW - M - 23, 15.4, { align: "center" });
  y = 49;

  // demo banner
  if (c.disclaimer) {
    fill(C.amberSoft); stroke([236, 217, 174]); doc.setLineWidth(0.25); doc.rect(M, y, CW, 11, "FD");
    fill(C.amber); doc.rect(M, y, 1.4, 11, "F");
    ink(C.amberInk); font("bold", 8.5); text(c.disclaimer, M + 5, y + 4.6);
    font("normal", 7.2); text("Simulated events, facilities and history. Not a live NASA FIRMS detection or a real emergency.", M + 5, y + 8.5);
    y += 16;
  }

  // live-data banner: names the sources and states that the result is a prototype assessment
  if (c.liveNote) {
    const nl = lines(c.liveNote, CW - 8, 7.4), bh = 8 + nl.length * 3.3;
    fill([237, 243, 248]); stroke([205, 219, 231]); doc.setLineWidth(0.25); doc.rect(M, y, CW, bh, "FD");
    fill(C.blue); doc.rect(M, y, 1.4, bh, "F");
    ink(C.navy); font("bold", 8.2); text(LIVE_BANNER_TITLE, M + 5, y + 4.6);
    ink(C.ink); font("normal", 7.4); nl.forEach((l, i) => text(l, M + 5, y + 8.4 + i * 3.3));
    y += bh + 5;
  }

  // metadata strip
  const meta: [string, string, boolean][] = [
    ["Report ID", c.reportId, true], ["Event ID", c.eventId, true],
    ["Generated", formatIST(c.generatedAt), true], ["Investigation status", c.investigationStatus, false],
    ["Alert ID", c.alertId ?? "-", true], ["Report status", c.recordStatus === "unsaved" ? "PREVIEW" : REPORT_STATUS_LABEL[c.recordStatus], false],
  ];
  const mw = CW / 3;
  meta.forEach(([k, v, mono], i) => {
    const cx = M + (i % 3) * mw, cy = y + Math.floor(i / 3) * 11;
    ink(C.muted); font("normal", 7); text(k, cx, cy);
    ink(C.ink); font("bold", 9, mono ? "courier" : "helvetica"); text(v, cx, cy + 4.6, { maxWidth: mw - 3 });
  });
  y += 25;

  // ---------- helpers for sections
  const section = (n: number, title: string, keepWith = 24) => {
    need(keepWith);
    ink(C.navy); font("bold", 10.5); text(`${n}. ${title}`, M, y);
    stroke(C.blue); doc.setLineWidth(0.5); doc.line(M, y + 1.8, M + 14, y + 1.8);
    stroke(C.line); doc.setLineWidth(0.2); doc.line(M + 14, y + 1.8, PW - M, y + 1.8);
    y += 7;
  };
  const para = (s: string, size = 9, col: RGB = C.ink, w = CW, x = M, bold = false) => {
    font(bold ? "bold" : "normal", size); ink(col);
    const lh = size * 0.46;
    for (const l of lines(s, w)) { need(lh + 1); text(l, x, y); y += lh; }
    y += 1.6;
  };
  const kv = (fields: { label: string; value: string; mono?: boolean }[], cols = 2) => {
    const cw = CW / cols;
    const rowsN = Math.ceil(fields.length / cols);
    for (let r = 0; r < rowsN; r++) {
      need(10);
      for (let k = 0; k < cols; k++) {
        const f = fields[r * cols + k]; if (!f) continue;
        const x = M + k * cw;
        ink(C.muted); font("normal", 7); text(f.label, x, y);
        ink(C.ink); font("bold", 9, f.mono ? "courier" : "helvetica"); text(f.value, x, y + 4.4, { maxWidth: cw - 4 });
      }
      stroke(C.line); doc.setLineWidth(0.15); doc.line(M, y + 6.4, PW - M, y + 6.4);
      y += 9.6;
    }
    y += 1;
  };
  const bar = (x: number, yy: number, w: number, h: number, frac: number, col: RGB) => {
    fill(C.soft); doc.rect(x, yy, w, h, "F");
    fill(col); doc.rect(x, yy, Math.max(0, Math.min(1, frac)) * w, h, "F");
  };

  // ---------- 1. Event overview
  section(1, "Event Overview");
  kv(c.overview);

  // ---------- 2. Geospatial context
  section(2, "Map / Geospatial Context", 100);
  const mh = 60;
  need(mh + 12);
  const g = c.map, pr = makeProjector(g, CW, mh);
  fill([238, 242, 245]); stroke(C.line); doc.setLineWidth(0.25); doc.rect(M, y, CW, mh, "FD");
  // grid at the scale-bar spacing
  stroke([225, 231, 236]); doc.setLineWidth(0.12);
  for (let gx = Math.ceil(g.bounds.minX / g.scaleKm) * g.scaleKm; gx <= g.bounds.maxX; gx += g.scaleKm) doc.line(M + pr.px(gx), y, M + pr.px(gx), y + mh);
  for (let gy = Math.ceil(g.bounds.minY / g.scaleKm) * g.scaleKm; gy <= g.bounds.maxY; gy += g.scaleKm) doc.line(M, y + pr.py(gy), M + CW, y + pr.py(gy));
  // 1 km facility zones
  stroke(C.orange); doc.setLineWidth(0.3); doc.setLineDashPattern([1.2, 0.9], 0);
  for (const z of g.zones) doc.circle(M + pr.px(z.x), y + pr.py(z.y), z.rKm * pr.scale, "S");
  // link to nearest facility
  const near = g.points.find((p) => p.kind === "facility");
  stroke(C.navy); doc.setLineWidth(0.25); doc.setLineDashPattern([0.8, 0.8], 0);
  if (near) doc.line(M + pr.px(0), y + pr.py(0), M + pr.px(near.x), y + pr.py(near.y));
  doc.setLineDashPattern([], 0);
  // points
  for (const p of g.points) {
    const px = M + pr.px(p.x), py = y + pr.py(p.y);
    if (p.kind === "facility") { fill(C.navy); stroke(C.white); doc.setLineWidth(0.4); doc.rect(px - 1.8, py - 1.8, 3.6, 3.6, "FD"); ink(C.navy); font("bold", 7.5); text(p.label, px + 3, py - 2.2); }
    else { fill(C.red); stroke(C.white); doc.setLineWidth(0.5); doc.circle(px, py, 2.1, "FD"); ink(C.red); font("bold", 7.5); text("E  " + p.name, px + 3.2, py + 4.2); }
  }
  // scale bar + north arrow
  const sbw = g.scaleKm * pr.scale, sx = M + 4, sy = y + mh - 5;
  stroke(C.ink); doc.setLineWidth(0.5); doc.line(sx, sy, sx + sbw, sy); doc.line(sx, sy - 1, sx, sy + 1); doc.line(sx + sbw, sy - 1, sx + sbw, sy + 1);
  ink(C.ink); font("normal", 7); text(`${g.scaleKm} km`, sx + sbw / 2, sy - 1.8, { align: "center" });
  const nx = M + CW - 6; fill(C.ink); doc.triangle(nx, y + 4, nx - 1.8, y + 9, nx + 1.8, y + 9, "F"); font("bold", 7); text("N", nx, y + 13, { align: "center" });
  y += mh + 4;
  font("normal", 7); ink(C.muted);
  text("E = thermal event   F1..F3 = nearby facilities (see section 7)   dashed circle = 1 km facility zone", M, y); y += 3.4;
  for (const l of lines(g.note, CW, 7)) { text(l, M, y); y += 3.1; }
  y += 3;

  // ---------- 3. Classification
  section(3, "AI-Assisted Geospatial Classification");
  need(22);
  fill(C.soft); doc.rect(M, y - 1, CW, 17, "F");
  ink(C.muted); font("normal", 7); text("FINAL CLASSIFICATION", M + 3, y + 3);
  ink(C.ink); font("bold", 13); text(c.classification.label, M + 3, y + 10);
  ink(C.muted); font("normal", 7.5); text(`Operational group: ${c.classification.group}`, M + 3, y + 14.2);
  ink(C.muted); font("normal", 7); text("CONFIDENCE (RULE AGREEMENT)", PW - M - 3, y + 3, { align: "right" });
  ink(C.ink); font("bold", 13, "courier"); text(`${c.classification.confidence}%`, PW - M - 3, y + 10, { align: "right" });
  bar(PW - M - 53, y + 12.2, 50, 1.8, c.classification.confidence / 100, C.blue);
  y += 21;
  para(c.classification.method, 8.5, C.ink);
  if (c.classification.basis.length) {
    font("bold", 8); ink(C.muted); need(8); text("CLASSIFICATION FACTORS (RULE COMPONENTS FOR THE WINNING CLASS)", M, y); y += 4;
    for (const b of c.classification.basis) {
      need(6.5); ink(C.ink); font("normal", 8.5); text(b.label, M, y + 2.2);
      bar(M + 84, y + 0.6, 70, 2.2, b.score / 100, C.blue);
      font("bold", 8.5, "courier"); text(`${b.score}%`, PW - M, y + 2.4, { align: "right" }); y += 6;
    }
    y += 1;
  }
  fill(C.soft); const mn = lines(METHOD_NOTE, CW - 8, 7.2); need(mn.length * 3.3 + 7);
  doc.rect(M, y, CW, mn.length * 3.3 + 4, "F"); fill(C.blue); doc.rect(M, y, 1.2, mn.length * 3.3 + 4, "F");
  ink(C.muted); font("normal", 7.2); mn.forEach((l, i) => text(l, M + 4, y + 4 + i * 3.3)); y += mn.length * 3.3 + 8;

  // ---------- 4. Why flagged
  section(4, "Why This Event Was Flagged");
  if (c.flagged.length) {
    for (const f of c.flagged) {
      const dl = lines(f.detail, CW - 8, 8); need(6 + dl.length * 3.6);
      fill(C.green); doc.circle(M + 1.6, y - 1, 1.1, "F");
      ink(C.ink); font("bold", 9); text(f.text, M + 6, y);
      ink(C.muted); font("normal", 8); dl.forEach((l, i) => text(l, M + 6, y + 4 + i * 3.6)); y += 5.5 + dl.length * 3.6;
    }
  } else para("No individual factor reached the 50% evidence threshold, so no supporting evidence is listed for this event.", 9, C.muted);
  font("normal", 7); ink(C.muted); need(5); text("Only factors at or above 50% from the event's own analysis are listed.", M, y); y += 6;

  // ---------- 5. Risk assessment
  section(5, "Risk Assessment", 56);
  need(40);
  ink(RISK_RGB[c.riskLevel]); font("bold", 26, "courier"); text(String(c.riskScore), M, y + 8);
  const sw = doc.getTextWidth(String(c.riskScore));
  ink(C.muted); font("normal", 10); text("/ 100", M + sw + 2, y + 8);
  fill(RISK_RGB[c.riskLevel]); doc.roundedRect(M + sw + 20, y + 1.8, 46, 7.5, 1, 1, "F");
  ink(C.white); font("bold", 8.5); text(`RISK LEVEL: ${RISK_LABEL[c.riskLevel]}`, M + sw + 43, y + 6.8, { align: "center" });
  y += 14;
  // scale bar with bands
  let bx = M; const total = 101;
  for (const b of RISK_BANDS) {
    const bw = ((b.max - b.min + 1) / total) * CW;
    fill(RISK_RGB[b.level]); doc.rect(bx, y, bw, 3, "F");
    ink(C.muted); font("normal", 6.5); text(`${b.label} ${b.range}`, bx + bw / 2, y + 6.6, { align: "center" }); bx += bw;
  }
  const mx = M + (Math.min(c.riskScore, 100) / total) * CW + CW / total / 2;
  fill(C.ink); doc.triangle(mx, y - 0.3, mx - 1.6, y - 3.4, mx + 1.6, y - 3.4, "F");
  y += 11;
  font("bold", 8); ink(C.muted); text("CONTRIBUTING RISK FACTORS (VALUE x WEIGHT = POINTS)", M, y); y += 4.5;
  for (const f of c.factors) {
    const dl = lines(f.detail, CW - 4, 7.5); need(13 + dl.length * 3.4);
    ink(C.ink); font("bold", 8.8); text(f.label, M, y + 2);
    font("normal", 8); ink(C.muted); text(`weight ${Math.round(f.weight * 100)}%`, M + 62, y + 2);
    ink(C.ink); font("bold", 8.5, "courier"); text(`${Math.round(f.value * 100)}%   +${f.points.toFixed(1)} pts`, PW - M, y + 2, { align: "right" });
    bar(M, y + 3.6, CW, 2.2, f.value, f.value >= 0.5 ? RISK_RGB[c.riskLevel === "low" ? "moderate" : c.riskLevel] : C.blue);
    ink(C.muted); font("normal", 7.5); dl.forEach((l, i) => text(l, M, y + 9 + i * 3.4)); y += 10.5 + dl.length * 3.4;
  }
  need(8); stroke(C.line); doc.setLineWidth(0.2); doc.line(M, y - 1, PW - M, y - 1);
  ink(C.ink); font("bold", 8.5); text("Prototype Risk Score = sum of (factor x weight)", M, y + 3.5);
  font("bold", 9, "courier"); text(`${c.factors.reduce((a, f) => a + f.points, 0).toFixed(1)}  ->  ${c.riskScore}`, PW - M, y + 3.5, { align: "right" }); y += 15;

  // ---------- 6. Persistence
  const p = c.persistence;
  section(6, "Persistence Analysis", 70);
  kv([
    { label: "Persistence status", value: p.label }, { label: "Related / repeated detections", value: p.hasHistory ? `${p.active} of ${p.total} days (${p.percent}%)` : "Not available", mono: true },
    { label: "First detected activity", value: p.firstActive ?? "Not available" }, { label: "Most recent activity", value: p.lastActive ?? "Not available" },
    { label: "Longest streak", value: p.hasHistory ? days(p.longestStreak) : "Not available", mono: true }, { label: "Current streak", value: p.hasHistory ? days(p.currentStreak) : "Not available", mono: true },
  ]);
  para(p.meaning, 8.5, C.ink);
  para(`Historical trend: ${p.trend}`, 8.5, C.ink);
  if (p.hasHistory) {
    const ch = 34, n = p.history.length; need(ch + 20);
    const maxF = Math.max(1, ...p.history.map((o) => o.frpMw ?? 0), p.baseline ?? 0) * 1.08;
    const gap = 1.6, bw = (CW - gap * (n - 1)) / n;
    fill(C.soft); doc.rect(M, y, CW, ch, "F");
    p.history.forEach((o, i) => {
      const x = M + i * (bw + gap);
      if (o.active) { const h = ((o.frpMw ?? 0) / maxF) * (ch - 4); fill(C.blue); doc.rect(x, y + ch - h, bw, h, "F"); ink(C.ink); font("normal", 6.5); text(String(Math.round(o.frpMw ?? 0)), x + bw / 2, y + ch - h - 0.8, { align: "center" }); }
      else { fill(C.line); doc.rect(x, y + ch - 1, bw, 1, "F"); }
    });
    if (p.baseline != null) {
      const by = y + ch - (p.baseline / maxF) * (ch - 4);
      stroke(C.amber); doc.setLineWidth(0.3); doc.setLineDashPattern([1.2, 0.9], 0); doc.line(M, by, M + CW, by); doc.setLineDashPattern([], 0);
    }
    p.history.forEach((o, i) => { const x = M + i * (bw + gap) + bw / 2; ink(C.muted); font("bold", 6.5); text(`D${o.day}`, x, y + ch + 3.2, { align: "center" }); font("normal", 6); text(formatDay(o.date), x, y + ch + 6.2, { align: "center" }); });
    y += ch + 10;
    font("normal", 7); ink(C.muted);
    text(`Bar = detection, FRP in MW. Short grey tick = no detection.${p.baseline != null ? ` Dashed line = mean FRP of earlier detections (${p.baseline.toFixed(1)} MW).` : ""} ${c.isDemo ? " Simulated history." : " NASA FIRMS window."}`, M, y); y += 6;
  } else para(p.available ? "No observation history is available for this event, so no persistence timeline can be shown." : "Historical persistence unavailable for this live observation, so no persistence timeline is shown. No history is simulated.", 9, C.muted);

  // ---------- 7. Industrial context
  const ind = c.industrial;
  section(7, "Industrial Context", 50);
  if (!ind.rows.length) para(ind.emptyNote, 9, C.muted);
  else {
    para(`Land-use context: ${ind.land}.`, 8.5, C.ink);
    const cols = [M, M + 9, M + 66, M + 100, M + 117, M + 138, M + 158] as const;
    const head = ["Ref", "Facility", "Type", "Distance", "Zone", "Related events", "Facility risk"];
    need(12); fill(C.navy); doc.rect(M, y, CW, 6.4, "F"); ink(C.white); font("bold", 7);
    head.forEach((h, i) => text(h, cols[i] + 1.5, y + 4.3)); y += 6.4;
    ind.rows.forEach((r, ri) => {
      const nl = lines(r.name, 54, 8, "bold"), tl = lines(r.type, 32, 8), h = Math.max(nl.length, tl.length) * 3.6 + 3.6; need(h);
      if (ri % 2) { fill(C.soft); doc.rect(M, y, CW, h, "F"); }
      ink(C.ink); font("bold", 8, "courier"); text(r.label, cols[0] + 1.5, y + 4.6);
      font("bold", 8); nl.forEach((l, i) => text(l, cols[1] + 1.5, y + 4.6 + i * 3.6));
      font("normal", 8); tl.forEach((l, i) => text(l, cols[2] + 1.5, y + 4.6 + i * 3.6));
      font("bold", 8, "courier"); text(`${r.km.toFixed(2)} km`, cols[3] + 1.5, y + 4.6);
      font("normal", 8); text(r.inZone ? "Inside 1 km" : "Outside 1 km", cols[4] + 1.5, y + 4.6);
      text(r.relatedEvents == null ? "n/a" : `${r.relatedEvents} (${r.openEvents ?? 0} open)`, cols[5] + 1.5, y + 4.6);
      text(r.facilityRisk ?? "n/a", cols[6] + 1.5, y + 4.6); y += h;
    });
    stroke(C.line); doc.setLineWidth(0.2); doc.line(M, y, PW - M, y); y += 3.5;
    if (ind.nearest) { const n = ind.nearest; para(`Nearest facility: ${n.name} (${n.type}), ${n.km.toFixed(2)} km from the event${n.facilityPersistence ? `; facility-level thermal activity: ${n.facilityPersistence.toLowerCase()}` : ""}.`, 8.5, C.ink); }
    ink(C.muted); for (const l of lines(ind.note, CW, 7)) { need(3.4); text(l, M, y); y += 3.2; } y += 3;
  }

  // ---------- 8. Summary
  section(8, "Investigation Summary", 34);
  para(c.summary, 9.2, C.ink);

  // ---------- 9. Decision support
  section(9, "Prototype Decision Support", 52);
  const d = c.decision, stepLines = d.steps.map((s) => lines(s, CW - 12, 8.6));
  const bh = 15 + stepLines.reduce((a, l) => a + l.length * 3.9 + 1, 0) + lines(d.caveat, CW - 10, 7.4).length * 3.4;
  need(bh + 4);
  fill(C.soft); doc.rect(M, y, CW, bh, "F"); fill(RISK_RGB[d.level]); doc.rect(M, y, 1.8, bh, "F");
  ink(C.muted); font("normal", 7); text(`RISK LEVEL ${RISK_LABEL[d.level]}`, M + 6, y + 4.6);
  ink(C.ink); font("bold", 10.5); text(d.headline, M + 6, y + 10.2, { maxWidth: CW - 10 });
  let yy = y + 15.5; font("normal", 8.6);
  stepLines.forEach((sl) => { fill(C.ink); doc.circle(M + 7.2, yy - 1, 0.6, "F"); sl.forEach((l) => { text(l, M + 10, yy); yy += 3.9; }); yy += 1; });
  ink(C.muted); font("normal", 7.4); lines(d.caveat, CW - 10, 7.4).forEach((l) => { text(l, M + 6, yy + 0.6); yy += 3.4; });
  y += bh + 4;

  // ---------- Disclaimer
  const dtext = c.isDemo ? DEMO_DISCLAIMER_LONG : `${c.liveNote} Outputs have not been validated against real incidents.`;
  const dl = lines(dtext, CW - 8, 7.8); need(dl.length * 3.6 + 10);
  fill(C.amberSoft); doc.rect(M, y, CW, dl.length * 3.6 + 9, "F"); fill(C.amber); doc.rect(M, y, 1.4, dl.length * 3.6 + 9, "F");
  ink(C.amberInk); font("bold", 8); text(c.isDemo ? DEMO_DISCLAIMER : "PROTOTYPE REPORT", M + 5, y + 4.8);
  font("normal", 7.8); dl.forEach((l, i) => text(l, M + 5, y + 9 + i * 3.6));

  // ---------- Running header (pages 2+) and footer (all pages)
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    if (i > 1) {
      ink(C.navy); font("bold", 7.5); text("THERMOGUARD AI  |  Thermal Event Investigation Report", M, 11);
      ink(C.muted); font("normal", 7.5); text(`${c.reportId}  |  ${c.eventId}`, PW - M, 11, { align: "right" });
      stroke(C.line); doc.setLineWidth(0.2); doc.line(M, 13.5, PW - M, 13.5);
    }
    stroke(C.line); doc.setLineWidth(0.2); doc.line(M, PH - 14, PW - M, PH - 14);
    ink(C.muted); font("normal", 7);
    text(c.isDemo ? DEMO_DISCLAIMER : "Source: NASA FIRMS | Context: OpenStreetMap | Prototype decision-support report", M, PH - 9.5);
    text(`Page ${i} of ${pages}`, PW - M, PH - 9.5, { align: "right" });
    font("normal", 6.5); text(`Generated ${formatIST(c.generatedAt)}  |  Prototype risk score and classification are rule-based and not validated.`, M, PH - 6);
  }
  return doc;
}

export const pdfFileName = (c: ReportContent) => `ThermoGuard_${c.reportId}_${c.eventId}.pdf`;

/** Builds and downloads the PDF. Throws on failure so the caller can show an error. */
export async function exportReportPdf(c: ReportContent): Promise<void> {
  const doc = await buildReportPdf(c);
  doc.save(pdfFileName(c));
}
