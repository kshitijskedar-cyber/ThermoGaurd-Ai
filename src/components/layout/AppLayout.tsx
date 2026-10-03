import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import Icon from "@/components/common/Icon";
import StatusDot from "@/components/common/StatusDot";
import { useThermalData } from "@/hooks/useThermalData";
import { formatIST } from "@/utils/format";
import Header from "./Header";
import Sidebar from "./Sidebar";
import { NAV_ITEMS } from "./nav";

const TABS = [
  { path: "/", label: "Home", icon: "grid" },
  { path: "/map", label: "Map", icon: "map" },
  { path: "/alerts", label: "Alerts", icon: "bell" },
  { path: "/sites", label: "Sites", icon: "factory" },
] as const;

export default function AppLayout() {
  const [drawer, setDrawer] = useState(false);
  const { pathname } = useLocation();
  const { dataset, source } = useThermalData();
  const current = NAV_ITEMS.find((n) => n.path === pathname) ?? NAV_ITEMS.find((n) => n.path !== "/" && pathname.startsWith(`${n.path}/`)) ?? NAV_ITEMS[0];
  useEffect(() => setDrawer(false), [pathname]);

  return (
    <div className="app-shell">
      <Sidebar open={drawer} onClose={() => setDrawer(false)} />
      {drawer && <button className="sidebar-backdrop" onClick={() => setDrawer(false)} aria-label="Close navigation" />}
      <div className="app-main">
        <Header onMenu={() => setDrawer(true)} />
        <main className="content" id="main">
          {source.isLive ? (
            <div className="demo-banner live" role="note">
              <strong>LIVE FIRMS</strong> NASA FIRMS thermal anomaly observations with OpenStreetMap context. Classification and risk are ThermoGuard's prototype decision-support assessment; a thermal anomaly is not a confirmed fire.
            </div>
          ) : (
            <div className={`demo-banner ${source.kind === "fallback" ? "fallback" : ""}`} role="note">
              <strong>{source.kind === "fallback" ? "LIVE DATA UNAVAILABLE · DEMO FALLBACK" : "DEMO DATA"}</strong> Simulated observations for prototype demonstration. This is not live satellite data.
              {source.kind === "fallback" && source.notes.length > 0 && <span className="banner-notes"> {source.notes.join(" ")}</span>}
            </div>
          )}
          {source.isLive && source.notes.length > 0 && <div className="demo-banner notice" role="status">{source.notes.join(" ")}</div>}
          <div className="page-heading">
            <div><h1 className="page-title">{current.title}</h1><div className="page-subtitle">{current.subtitle}</div></div>
            <div className="page-meta"><span className="demo"><StatusDot tone={source.tone} />{source.isLive ? "Live NASA FIRMS data" : "Demonstration dataset"}</span>{dataset && <span>{source.isLive ? `Fetched ${formatIST(source.updatedAt)}` : `Snapshot ${formatIST(dataset.referenceTime)}`}</span>}</div>
          </div>
          <Outlet />
        </main>
        <nav className="mobile-tabs" aria-label="Mobile navigation">
          {TABS.map((t) => (
            <NavLink key={t.path} to={t.path} end={t.path === "/"} className={({ isActive }) => (isActive ? "active" : "")}><Icon name={t.icon} /><span>{t.label}</span></NavLink>
          ))}
          <button onClick={() => setDrawer(true)} aria-label="More navigation"><Icon name="more" /><span>More</span></button>
        </nav>
      </div>
    </div>
  );
}
