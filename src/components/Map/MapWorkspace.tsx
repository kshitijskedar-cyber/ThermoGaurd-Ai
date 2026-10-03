import { Link } from "react-router-dom";
import { useThermalData } from "@/hooks/useThermalData";
import Icon from "@/components/common/Icon";
import StatusDot from "@/components/common/StatusDot";
import EventPanel from "@/components/Events/EventPanel";
import ThermalMap from "./ThermalMap";
import type { Facility, ThermalEvent } from "@/types";
import { formatIST } from "@/utils/format";

interface Props {
  variant: "overview" | "full" | "facility";
  /** Facility view: only these events / facilities are drawn. Omitted = the whole dataset. */
  events?: ThermalEvent[];
  facilities?: Facility[];
  title?: string;
  subtitle?: string;
}

/** Map + event panel, reused by the dashboard, the full map and Facility Intelligence. The .event-dock wrapper is the hook for the mobile bottom sheet. */
export default function MapWorkspace({ variant, events, facilities, title, subtitle }: Props) {
  const { dataset, selectedId, select, source } = useThermalData();
  if (!dataset) return null;
  const shownEvents = events ?? dataset.events;
  const shownFacilities = facilities ?? dataset.facilities;
  const selected = shownEvents.find((e) => e.id === selectedId) ?? null;
  return (
    <section className="map-card">
      <div className="map-header">
        <div>
          <div className="section-title">{title ?? "Thermal Activity"}</div>
          <div className="section-subtitle">{subtitle ?? (source.isLive ? `${dataset.live?.firms?.regionLabel ?? "Configured region"} · NASA FIRMS thermal anomalies · fetched ${formatIST(source.updatedAt)}` : `Western India demonstration region · snapshot ${formatIST(dataset.referenceTime)}`)}</div>
        </div>
        <div className="map-header-actions">
          <span className="time-filter static"><StatusDot tone={source.tone} /> {source.lines.join(" · ")}</span>
          {variant === "overview" && <Link className="plain-button" to="/map">Open full map <Icon name="expand" size={14} /></Link>}
        </div>
      </div>
      <div className={`map-layout ${variant === "overview" ? "" : "tall"}`}>
        <ThermalMap events={shownEvents} facilities={shownFacilities} selectedId={selected ? selectedId : null} onSelect={select} fitFacilities={variant === "facility"} />
        <aside className="event-dock" data-selected={selected ? "true" : "false"}>
          <EventPanel event={selected} facilities={dataset.facilities} />
        </aside>
      </div>
    </section>
  );
}
