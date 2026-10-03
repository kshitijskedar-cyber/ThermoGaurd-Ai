import { useMemo } from "react";
import DataGate from "@/components/common/DataGate";
import Icon from "@/components/common/Icon";
import StateBlock from "@/components/common/StateBlock";
import StatCards from "@/components/common/StatCards";
import FacilityRow from "@/components/Sites/FacilityRow";
import { useFacilityStats } from "@/hooks/useFacilityStats";
import { useThermalData } from "@/hooks/useThermalData";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { RISK_ORDER } from "@/services/intelligence/analytics";
import { RISK_LABEL, RISK_RANK } from "@/utils/format";
import type { Kpi } from "@/utils/kpis";
import type { FacilityStats } from "@/types/intelligence";
import { DataTag } from "@/components/common/SourceTag";

type Filters = { q: string; type: string; risk: string; sort: string };
const DEFAULTS: Filters = { q: "", type: "all", risk: "all", sort: "risk" };

const rank = (s: FacilityStats) => (s.riskStatus === "normal" ? 0 : RISK_RANK[s.riskStatus]);
const SORTS: Record<string, (a: FacilityStats, b: FacilityStats) => number> = {
  risk: (a, b) => rank(b) - rank(a) || (b.highest?.score ?? 0) - (a.highest?.score ?? 0) || b.total - a.total || a.facility.name.localeCompare(b.facility.name),
  events: (a, b) => b.total - a.total || rank(b) - rank(a) || a.facility.name.localeCompare(b.facility.name),
  name: (a, b) => a.facility.name.localeCompare(b.facility.name),
};

function Sites() {
  const { dataset, source } = useThermalData();
  const stats = useFacilityStats();
  const [f, setF] = useUrlFilters(DEFAULTS);

  const types = useMemo(() => [...new Set(stats.map((s) => s.facility.type))].sort(), [stats]);
  const kpis: Kpi[] = useMemo(() => [
    { label: "Facilities Monitored", value: stats.length, note: `${types.length} facility types`, icon: "factory", tone: "blue" },
    { label: "Open High / Critical", value: stats.filter((s) => s.riskStatus === "critical" || s.riskStatus === "high").length, note: "facilities", icon: "flame", tone: "orange" },
    { label: "Persistent Activity", value: stats.filter((s) => s.persistence === "persistent").length, note: "facilities", icon: "clock", tone: "amber" },
    { label: "No Nearby Events", value: stats.filter((s) => s.total === 0).length, note: "facilities", icon: "shield", tone: "green" },
  ], [stats, types.length]);

  const visible = useMemo(() => {
    const q = f.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return stats
      .filter((s) => (f.type === "all" || s.facility.type === f.type) && (f.risk === "all" || s.riskStatus === f.risk)
        && q.every((t) => `${s.facility.name} ${s.facility.type} ${s.facility.region} ${s.facility.id}`.toLowerCase().includes(t)))
      .sort(SORTS[f.sort] ?? SORTS.risk);
  }, [stats, f.q, f.type, f.risk, f.sort]);

  const active = !!(f.q || f.type !== "all" || f.risk !== "all");
  const clear = () => setF({ q: "", type: "all", risk: "all" });
  if (!dataset) return null;

  return (
    <div className="sites-page">
      <StatCards kpis={kpis} label="Facility summary" columns={4} wrap />
      <section className="inv-panel" aria-label="Industrial facilities">
        <div className="filter-bar" role="search">
          <label className="filter-search">
            <Icon name="search" size={16} />
            <input type="search" value={f.q} onChange={(e) => setF({ q: e.target.value })} placeholder="Search facility name, type or region" aria-label="Search facilities" />
          </label>
          <label className="filter-field"><span>Facility type</span>
            <select value={f.type} onChange={(e) => setF({ type: e.target.value })}>
              <option value="all">All types</option>{types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select></label>
          <label className="filter-field"><span>Risk status</span>
            <select value={f.risk} onChange={(e) => setF({ risk: e.target.value })}>
              <option value="all">All levels</option>{RISK_ORDER.map((r) => <option key={r} value={r}>{RISK_LABEL[r]}</option>)}<option value="normal">NORMAL</option>
            </select></label>
          <label className="filter-field"><span>Sort</span>
            <select value={f.sort} onChange={(e) => setF({ sort: e.target.value })}>
              <option value="risk">Highest risk</option><option value="events">Most thermal events</option><option value="name">Name A–Z</option>
            </select></label>
          <button className="secondary-action filter-clear" onClick={clear} disabled={!active}>CLEAR FILTERS</button>
        </div>
        <div className="list-meta">
          <span>Showing <b>{visible.length}</b> of <b>{stats.length}</b> facilities</span>
          <span className="list-meta-right"><DataTag /></span>
        </div>
        {visible.length === 0
          ? <div className="list-empty"><StateBlock variant="empty" icon="factory" title="No facilities match the current filters" detail="Relax or clear the filters to see facilities again." action={{ label: "Clear filters", onClick: clear }} /></div>
          : <>
              <div className="site-head" aria-hidden="true">
                <span>FACILITY</span><span>LOCATION</span><span>RISK STATUS</span><span>NEARBY EVENTS</span><span>HIGHEST NEARBY RISK</span><span>PERSISTENT ACTIVITY</span><span>LAST DETECTED</span>
              </div>
              <ul className="site-list">{visible.map((s) => <FacilityRow key={s.facility.id} s={s} />)}</ul>
            </>}
        <p className="inv-foot list-foot">
          Nearby events are thermal events whose nearest facility is this one, within 5 km. Risk status is the highest risk among those events whose alert is still open; NORMAL means none are open.
          {source.isLive ? "Facilities are OpenStreetMap objects (volunteer-mapped, uneven coverage). Names come from OSM where tagged; operating status is not available." : "Facility names and locations are fictional demonstration data."}
        </p>
      </section>
    </div>
  );
}

export default function SitesPage() { return <DataGate><Sites /></DataGate>; }
