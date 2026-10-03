import { useCallback, useMemo } from "react";
import DataGate from "@/components/common/DataGate";
import Icon from "@/components/common/Icon";
import StateBlock from "@/components/common/StateBlock";
import StatCards from "@/components/common/StatCards";
import AlertRow from "@/components/Alerts/AlertRow";
import AlertDetailPanel from "@/components/Alerts/AlertDetailPanel";
import { useAlerts } from "@/hooks/useAlerts";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { PRIORITY_BY_RISK, STATUS_LABEL, STATUS_ORDER } from "@/services/intelligence/alerts";
import { RISK_ORDER } from "@/services/intelligence/analytics";
import { CLASS_LABEL, RISK_LABEL, RISK_RANK } from "@/utils/format";
import type { Kpi } from "@/utils/kpis";
import type { Alert } from "@/types/intelligence";
import { DataTag } from "@/components/common/SourceTag";
import { useThermalData } from "@/hooks/useThermalData";

type Filters = { q: string; risk: string; status: string; cls: string; sort: string; alert: string };
const DEFAULTS: Filters = { q: "", risk: "all", status: "all", cls: "all", sort: "newest", alert: "" };

function matches(a: Alert, q: string) {
  if (!q) return true;
  const hay = [a.id, a.eventId, a.region, CLASS_LABEL[a.classification], a.nearest?.name ?? "", a.nearest?.type ?? "", a.priorityLabel, RISK_LABEL[a.riskLevel], STATUS_LABEL[a.status], a.persistence.label].join(" ").toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((t) => hay.includes(t));
}

function Alerts() {
  const { alerts, summary, overrides, setStatus, resetStatuses, byId } = useAlerts();
  const { source } = useThermalData();
  const [f, setF, params] = useUrlFilters(DEFAULTS);

  const kpis: Kpi[] = useMemo(() => {
    const open = alerts.filter((a) => a.status !== "resolved");
    const newOf = (lvl: string) => open.filter((a) => a.riskLevel === lvl && a.status === "new").length;
    return [
      { label: "Total Active Alerts", value: summary.active, note: `of ${summary.total} alerts`, icon: "bell", tone: "blue" },
      { label: "Critical Alerts", value: summary.critical, note: `${newOf("critical")} new`, icon: "flame", tone: "red" },
      { label: "High Risk Alerts", value: summary.high, note: `${newOf("high")} new`, icon: "shield", tone: "orange" },
      { label: "Under Investigation", value: summary.investigating, note: "in progress", icon: "scan", tone: "amber" },
      { label: "Resolved", value: summary.resolved, note: `${summary.total ? Math.round((summary.resolved / summary.total) * 100) : 0}% of alerts`, icon: "shield", tone: "green" },
    ];
  }, [alerts, summary]);

  const classOptions = useMemo(() => [...new Set(alerts.map((a) => a.classification))].sort((x, y) => CLASS_LABEL[x].localeCompare(CLASS_LABEL[y])), [alerts]);

  const visible = useMemo(() => {
    const list = alerts.filter((a) =>
      (f.risk === "all" || a.riskLevel === f.risk) && (f.status === "all" || a.status === f.status) && (f.cls === "all" || a.classification === f.cls) && matches(a, f.q.trim()));
    return list.sort(f.sort === "risk"
      ? (x, y) => y.riskScore - x.riskScore || RISK_RANK[y.riskLevel] - RISK_RANK[x.riskLevel] || Date.parse(y.timestamp) - Date.parse(x.timestamp)
      : (x, y) => Date.parse(y.timestamp) - Date.parse(x.timestamp));
  }, [alerts, f.risk, f.status, f.cls, f.q, f.sort]);

  const filtersActive = !!(f.q || f.risk !== "all" || f.status !== "all" || f.cls !== "all");
  const clear = () => setF({ q: "", risk: "all", status: "all", cls: "all" });
  const selected = f.alert ? byId(f.alert) : undefined;
  const closePanel = useCallback(() => setF({ alert: "" }), [setF]);
  const openTo = (id: string) => { const p = new URLSearchParams(params); p.set("alert", id); return `?${p.toString()}`; };

  return (
    <div className="alerts-page">
      {f.alert && !selected && (
        <div className="notice-bar" role="status">
          <span>Alert <b className="mono">{f.alert}</b> was not found in the loaded dataset.</span>
          <button className="plain-button" onClick={closePanel}>Dismiss</button>
        </div>
      )}
      <StatCards kpis={kpis} label="Alert summary" wrap />

      <section className="inv-panel" aria-label="Alert list">
        <div className="filter-bar" role="search">
          <label className="filter-search">
            <Icon name="search" size={16} />
            <input type="search" value={f.q} onChange={(e) => setF({ q: e.target.value })} placeholder="Search alert, event, region, site, classification" aria-label="Search alerts" />
          </label>
          <label className="filter-field"><span>Risk</span>
            <select value={f.risk} onChange={(e) => setF({ risk: e.target.value })}>
              <option value="all">All levels</option>{RISK_ORDER.map((r) => <option key={r} value={r}>{RISK_LABEL[r]}</option>)}
            </select></label>
          <label className="filter-field"><span>Status</span>
            <select value={f.status} onChange={(e) => setF({ status: e.target.value })}>
              <option value="all">All statuses</option>{STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select></label>
          <label className="filter-field"><span>Classification</span>
            <select value={f.cls} onChange={(e) => setF({ cls: e.target.value })}>
              <option value="all">All classifications</option>{classOptions.map((c) => <option key={c} value={c}>{CLASS_LABEL[c]}</option>)}
            </select></label>
          <label className="filter-field"><span>Sort</span>
            <select value={f.sort} onChange={(e) => setF({ sort: e.target.value })}>
              <option value="newest">Newest first</option><option value="risk">Highest risk first</option>
            </select></label>
          <button className="secondary-action filter-clear" onClick={clear} disabled={!filtersActive}>CLEAR FILTERS</button>
        </div>

        <div className="list-meta">
          <span>Showing <b>{visible.length}</b> of <b>{alerts.length}</b> alerts</span>
          <span className="list-meta-right">
            <DataTag />
            {Object.keys(overrides).length > 0 && <button className="plain-button" onClick={resetStatuses}>Reset statuses</button>}
          </span>
        </div>

        {visible.length === 0
          ? <div className="list-empty"><StateBlock variant="empty" icon="bell" title="No alerts match the current filters" detail="Relax or clear the filters to see alerts again." action={{ label: "Clear filters", onClick: clear }} /></div>
          : <>
              <div className="alert-head" aria-hidden="true">
                <span>ALERT</span><span>DETECTED · LOCATION</span><span>CLASSIFICATION</span><span>RISK</span><span>NEAREST SITE</span><span>PERSISTENCE</span><span>STATUS</span>
              </div>
              <ul className="alert-list">
                {visible.map((a) => <AlertRow key={a.id} alert={a} openTo={openTo(a.id)} onStatus={setStatus} selected={a.id === f.alert} />)}
              </ul>
            </>}

        <p className="inv-foot list-foot">
          Alerts are generated from thermal events using the Phase 2 risk level: {RISK_ORDER.map((r) => `${RISK_LABEL[r]} → ${PRIORITY_BY_RISK[r].label}`).join(" · ")}.
          {source.isLive ? "Each alert is ThermoGuard's assessment of a NASA FIRMS thermal anomaly observation (Source: NASA FIRMS); NASA FIRMS does not assign the risk level. New alerts start as NEW; status changes you make are kept in this browser only." : "Initial status comes from the demonstration dataset; status changes you make are kept in this browser only."}
        </p>
      </section>

      {selected && <AlertDetailPanel alert={selected} onClose={closePanel} />}
    </div>
  );
}

export default function AlertsPage() { return <DataGate><Alerts /></DataGate>; }
