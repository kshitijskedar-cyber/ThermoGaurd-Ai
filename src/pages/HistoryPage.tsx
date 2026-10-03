import { Link } from "react-router-dom";
import DataGate from "@/components/common/DataGate";
import { useThermalData } from "@/hooks/useThermalData";
import { useSelectedEvent } from "@/hooks/useSelectedEvent";
import NoEvent from "@/components/Investigation/NoEvent";
import { EventPicker, Panel, PersistenceChart, PersistenceSummary } from "@/components/Investigation/parts";
import { formatDay } from "@/utils/format";
import { HistoryTag } from "@/components/common/SourceTag";

function History() {
  const { assessments } = useThermalData();
  const { dataset, event, assessment: a, history, setEvent, unknownEventParam } = useSelectedEvent();
  if (!dataset || !event || !a) return <NoEvent unknown={unknownEventParam} />;
  return (
    <div className="inv">
      <div className="inv-toolbar">
        <EventPicker ds={dataset} value={event.id} onChange={setEvent} assessments={assessments} />
        <div className="inv-toolbar-actions"><Link className="primary-action link-btn" to={`/investigation?event=${event.id}`}>AI INVESTIGATE</Link></div>
      </div>
      <Panel eyebrow="HISTORICAL OBSERVATIONS" title={`Persistence Timeline · ${event.id}`} aside={<HistoryTag />}>
        <PersistenceSummary a={a} />
        {a.persistence.available && <PersistenceChart obs={history} baseline={a.persistence.baselineFrpMw} />}
      </Panel>
      <Panel eyebrow="OBSERVATION LOG" title="Daily Observations">
        <div className="table-scroll"><table className="mini-table log">
          <thead><tr><th>Day</th><th>Date</th><th>Detection</th><th>FRP</th></tr></thead>
          <tbody>{[...history].reverse().map((o) => (
            <tr key={o.day}><td className="mono">D{o.day}</td><td>{formatDay(o.date)}</td><td>{o.active ? "● Detected" : "— No detection"}</td><td className="mono">{o.frpMw != null ? `${o.frpMw} MW` : "—"}</td></tr>
          ))}</tbody>
        </table></div>
        <p className="inv-foot">A day without detection can mean no thermal activity or no usable satellite overpass (for example cloud cover); {event.source === "firms" ? "the FIRMS record does not distinguish the two. Only the fetched FIRMS window is shown." : "the demo history does not distinguish the two."}</p>
      </Panel>
    </div>
  );
}
export default function HistoryPage() { return <DataGate><History /></DataGate>; }
