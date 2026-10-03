import { Link } from "react-router-dom";
import { useAlerts } from "@/hooks/useAlerts";
import { AlertStatusChip } from "@/components/common/Chips";
import { RiskBadge } from "@/components/Investigation/parts";
import { CLASS_LABEL, formatShortIST } from "@/utils/format";

/** Dashboard entry point into the Alerts module: the open CRITICAL and HIGH alerts, highest score first. */
export default function PriorityAlerts() {
  const { alerts } = useAlerts();
  const urgent = alerts.filter((a) => a.status !== "resolved" && (a.riskLevel === "critical" || a.riskLevel === "high"))
    .sort((x, y) => y.riskScore - x.riskScore || Date.parse(y.timestamp) - Date.parse(x.timestamp));
  const shown = urgent.slice(0, 4);
  return (
    <section className="priority-strip" aria-label="Priority alerts">
      <div className="activity-head">
        <div>
          <div className="section-title">Priority Alerts</div>
          <div className="section-subtitle">{urgent.length ? `${urgent.length} open critical and high-priority ${urgent.length === 1 ? "alert" : "alerts"} · highest risk first` : "No open critical or high-priority alerts"}</div>
        </div>
        <Link className="plain-button" to="/alerts?sort=risk">View all alerts</Link>
      </div>
      {shown.length === 0
        ? <p className="priority-empty">Every critical and high-priority alert has been resolved.</p>
        : <ul className="priority-list">
            {shown.map((a) => (
              <li key={a.id}>
                <Link className={`priority-item sev-${a.riskLevel}`} to={`/alerts?alert=${a.id}`}>
                  <span className="pi-top"><RiskBadge level={a.riskLevel} /><b className="mono">{a.id}</b><span className="pi-score mono">{a.riskScore}</span></span>
                  <span className="pi-class">{CLASS_LABEL[a.classification]}</span>
                  <span className="pi-meta">{a.nearest ? `${a.nearest.name} · ${a.nearest.km.toFixed(2)} km` : a.region}</span>
                  <span className="pi-foot"><span className="mono">{formatShortIST(a.timestamp)}</span><AlertStatusChip status={a.status} /></span>
                </Link>
              </li>
            ))}
          </ul>}
    </section>
  );
}
