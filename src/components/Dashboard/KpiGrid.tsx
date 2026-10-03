import { useMemo } from "react";
import { useThermalData } from "@/hooks/useThermalData";
import Icon from "@/components/common/Icon";
import StatusDot from "@/components/common/StatusDot";
import { computeKpis } from "@/utils/kpis";

export default function KpiGrid() {
  const { dataset } = useThermalData();
  const kpis = useMemo(() => (dataset ? computeKpis(dataset) : []), [dataset]);
  return (
    <section className="kpi-grid" aria-label="Key indicators">
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
