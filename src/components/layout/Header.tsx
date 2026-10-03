import { useLocation, useNavigate } from "react-router-dom";
import Icon from "@/components/common/Icon";
import { useThermalData } from "@/hooks/useThermalData";
import { formatShortIST } from "@/utils/format";
import { Brand } from "./Sidebar";
import SourceChip from "./SourceChip";
import { NAV_ITEMS } from "./nav";

export default function Header({ onMenu }: { onMenu: () => void }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { dataset, source } = useThermalData();
  const current = NAV_ITEMS.find((n) => n.path === pathname) ?? NAV_ITEMS[0];
  return (
    <header className="topbar">
      <button className="icon-button mobile-menu" onClick={onMenu} aria-label="Open menu"><Icon name="menu" /></button>
      <div className="mobile-brand"><Brand /></div>
      <div className="breadcrumb"><span>Command Center</span><Icon name="chevron" size={13} /><strong>{current.label}</strong></div>
      <label className="search-box" title="Global search arrives in a later phase">
        <Icon name="search" size={17} />
        <input disabled aria-label="Search (not yet available)" placeholder="Search events, coordinates, facilities (coming soon)" />
      </label>
      <SourceChip />
      {dataset && !source.isLive && <div className="sat-update"><small>DEMO SNAPSHOT</small><strong>{formatShortIST(dataset.referenceTime)}</strong></div>}
      <button className="icon-button notify" aria-label="Open alerts" title="Alerts" onClick={() => navigate("/alerts")}><Icon name="bell" /><span className="notify-dot" /></button>
      <span className="top-avatar">AK</span>
    </header>
  );
}
