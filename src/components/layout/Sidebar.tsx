import { NavLink } from "react-router-dom";
import Icon from "@/components/common/Icon";
import StatusDot from "@/components/common/StatusDot";
import { useThermalData } from "@/hooks/useThermalData";
import { useAlerts } from "@/hooks/useAlerts";
import { NAV_ITEMS } from "./nav";

export function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark"><Icon name="satellite" size={21} /></div>
      <div><div className="brand-name">ThermoGuard <b>AI</b></div><div className="brand-tagline">THERMAL INTELLIGENCE</div></div>
    </div>
  );
}

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dataset, source } = useThermalData();
  const { summary } = useAlerts();
  const urgent = summary.critical + summary.high;
  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="sidebar-head"><Brand /><button className="icon-button mobile-close" onClick={onClose} aria-label="Close menu"><Icon name="close" /></button></div>
      <nav className="main-nav" aria-label="Primary navigation">
        <div className="nav-section-label">WORKSPACE</div>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.path} to={item.path} end={item.path === "/"} onClick={onClose}
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""} ${item.path === "/settings" ? "nav-settings" : ""}`}>
            <Icon name={item.icon} /><span>{item.label}</span>
            {item.path === "/alerts" && urgent > 0 && <span className="nav-badge">{urgent}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="system-state">
          <div className="state-row"><span><StatusDot tone={source.tone} /> {source.isLive ? "Live FIRMS data" : source.kind === "fallback" ? "Demo fallback" : "Demo dataset"}</span></div>
          <div className="updated">{dataset ? `${dataset.events.length} events · ${dataset.facilities.length} facilities` : "Loading..."}</div>
        </div>
        <div className="profile-row"><span className="avatar">AK</span><span className="profile-copy"><strong>Arjun Kulkarni</strong><small>Operations Analyst</small></span></div>
      </div>
    </aside>
  );
}
