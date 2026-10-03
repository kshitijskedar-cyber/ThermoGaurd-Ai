import { useEffect, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import DataGate from "@/components/common/DataGate";
import Icon from "@/components/common/Icon";
import StateBlock from "@/components/common/StateBlock";
import StatCards from "@/components/common/StatCards";
import { RiskStatusBadge } from "@/components/common/Chips";
import TimelinePanel from "@/components/Charts/TimelinePanel";
import MapWorkspace from "@/components/Map/MapWorkspace";
import { Panel } from "@/components/Investigation/parts";
import FacilityEvents from "@/components/Sites/FacilityEvents";
import FacilityPersistence from "@/components/Sites/FacilityPersistence";
import { useFacilityStats } from "@/hooks/useFacilityStats";
import { useThermalData } from "@/hooks/useThermalData";
import { RELATED_RADIUS_KM } from "@/services/intelligence/facilities";
import { formatCoord } from "@/utils/format";
import type { Kpi } from "@/utils/kpis";
import { DataTag, HistoryTag } from "@/components/common/SourceTag";

function Facility() {
  const { facilityId } = useParams();
  const { dataset, selectedId, select, source } = useThermalData();
  const stats = useFacilityStats();
  const navigate = useNavigate();
  const s = stats.find((x) => x.facility.id === facilityId);
  const relatedIds = useMemo(() => new Set(s?.events.map((x) => x.event.id) ?? []), [s]);
  const filter = useMemo(() => (e: { id: string }) => relatedIds.has(e.id), [relatedIds]);

  // Arriving on a facility highlights its highest-risk event on the map, unless an event of this facility is already selected.
  const topId = s?.highest?.eventId ?? s?.events[0]?.event.id ?? null;
  useEffect(() => {
    if (topId && (!selectedId || !relatedIds.has(selectedId))) select(topId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId, topId]);

  if (!dataset) return null;
  if (!s)
    return (
      <>
        <StateBlock variant="empty" icon="factory" title="That facility was not found" detail="The facility ID in the link does not exist in the loaded dataset." />
        <div style={{ textAlign: "center" }}><Link className="primary-action link-btn" to="/sites">Back to Industrial Sites</Link></div>
      </>
    );

  const f = s.facility;
  const kpis: Kpi[] = [
    { label: "Nearby Thermal Events", value: s.total, note: `${s.openCount} open`, icon: "flame", tone: "blue" },
    { label: "Critical Events", value: s.byRisk.critical, note: "risk 81–100", icon: "flame", tone: "red" },
    { label: "High-Risk Events", value: s.byRisk.high, note: "risk 61–80", icon: "shield", tone: "orange" },
    { label: "Persistent Events", value: s.persistentCount, note: source.isLive ? "≥ 60% of FIRMS window" : "≥ 6 of 10 days", icon: "clock", tone: "amber" },
  ];
  const mapEvents = s.events.map((x) => x.event);

  return (
    <div className="inv facility-page">
      <section className="facility-head" aria-label="Facility summary">
        <div className="fh-main">
          <Link className="back-link" to="/sites">← All industrial sites</Link>
          <div className="eyebrow">FACILITY INTELLIGENCE · <span className="mono">{f.id}</span></div>
          <h2 className="fh-name">{f.name}</h2>
          <div className="fh-meta">
            <span>{f.type}</span><span>{f.region}</span><span className="mono">{formatCoord(f.lat, f.lon)}</span>
          </div>
        </div>
        <div className="fh-side">
          <div className="fh-status"><small>CURRENT RISK STATUS</small><RiskStatusBadge status={s.riskStatus} /></div>
          <DataTag />
          {s.highest && (
            <button className="primary-action" onClick={() => navigate(`/investigation?event=${s.highest!.eventId}`)}><Icon name="scan" size={15} /> INVESTIGATE TOP EVENT</button>
          )}
        </div>
      </section>

      <StatCards kpis={kpis} label="Facility indicators" columns={4} wrap />

      <Panel eyebrow="THERMAL ACTIVITY" title={`Related Thermal Events · within ${RELATED_RADIUS_KM} km`} aside={<DataTag />}>
        <FacilityEvents events={s.events} />
        {s.events.length > 0 && <p className="inv-foot">Select an event to open its AI Investigation. Events are listed newest first.</p>}
      </Panel>

      <MapWorkspace key={f.id} variant="facility" events={mapEvents} facilities={[f]} title={`${f.name} · Thermal Context`}
        subtitle={`${s.total} related ${s.total === 1 ? "event" : "events"} within ${RELATED_RADIUS_KM} km · dashed ring is the 1 km facility zone`} />

      <TimelinePanel key={`tl-${f.id}`} ds={dataset} filter={filter} eyebrow="RISK AND ACTIVITY HISTORY" title="Activity Trend Near This Facility" subject={`a simulated activity history for ${f.name}`} />

      <Panel eyebrow="PERSISTENCE" title="Is Thermal Activity Repeating?" aside={<HistoryTag />}>
        <FacilityPersistence s={s} history={dataset.history} />
      </Panel>
    </div>
  );
}

export default function FacilityPage() { return <DataGate><Facility /></DataGate>; }
