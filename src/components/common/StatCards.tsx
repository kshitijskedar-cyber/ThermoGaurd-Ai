import Icon from "./Icon";
import StatusDot from "./StatusDot";
import type { Kpi } from "@/utils/kpis";

/** KPI card row. Same markup and styling as the Phase 1 dashboard KPIs; Phase 3A pages pass `columns`/`wrap` for their own layouts. */
export default function StatCards({ kpis, label = "Key indicators", columns, wrap = false }: { kpis: Kpi[]; label?: string; columns?: 3 | 4; wrap?: boolean }) {
  return (
    <section className={`kpi-grid ${columns ? `cols-${columns}` : ""} ${wrap ? "wrap" : ""}`} aria-label={label}>
      {kpis.map((k) => (
        <article className={`kpi-card ${k.tone}`} key={k.label}>
          <div className="kpi-top"><span className="kpi-icon"><Icon name={k.icon} size={17} /></span><StatusDot tone={k.tone} /></div>
          <div className="kpi-value">{k.value}</div>
          <div className="kpi-label">{k.label}</div>
          <div className="kpi-change"><Icon name="trend" size={13} />{k.note}</div>
        </article>
      ))}
    </section>
  );
}
