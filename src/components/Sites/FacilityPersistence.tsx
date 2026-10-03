import { Link } from "react-router-dom";
import type { Observation } from "@/types";
import type { FacilityStats } from "@/types/intelligence";
import { PersistenceChip } from "@/components/common/Chips";
import { PERSISTENT_RATIO } from "@/services/intelligence/persistence";
import { RELATED_RADIUS_KM } from "@/services/intelligence/facilities";
import { formatDay } from "@/utils/format";
import { useThermalData } from "@/hooks/useThermalData";

/** Plain-language reading of the facility's persistence, derived only from the related events' observation history. */
function summary(s: FacilityStats): string {
  const need = `${Math.round(PERSISTENT_RATIO * 10)} of 10 observation days`;
  switch (s.persistence) {
    case "persistent":
      return `Repeated thermal activity is occurring near this facility. ${s.persistentCount} of ${s.total} related ${s.total === 1 ? "event was" : "events were"} detected on at least ${need}; mean persistence is ${s.meanPersistencePercent}% and the longest unbroken streak is ${s.longestStreak} ${s.longestStreak === 1 ? "day" : "days"}.`;
    case "recurring":
      return `${s.total} thermal events were detected near this facility, but none reach the persistent threshold of ${need}. Mean persistence is ${s.meanPersistencePercent}%.`;
    case "unavailable":
      return "Historical persistence is unavailable for the related live observations: the FIRMS window held too few observation days to judge repeated activity.";
    case "isolated":
      return `A single thermal event was detected near this facility. It was seen on ${s.meanPersistencePercent}% of its observation days, so there is no repeated pattern yet.`;
    default:
      return `No thermal events lie within ${RELATED_RADIUS_KM} km of this facility in the loaded dataset.`;
  }
}

export default function FacilityPersistence({ s, history }: { s: FacilityStats; history: Record<string, Observation[]> }) {
  const { source, dataset } = useThermalData();
  return (
    <>
      <div className="fp-top"><PersistenceChip keyName={s.persistence} label={s.persistenceLabel} /><p className="inv-note fp-text">{summary(s)}</p></div>
      {s.events.length > 0 && (
        <ul className="fp-list">
          {s.events.map(({ event: e, persistence }) => {
            const obs = history[e.id] ?? [];
            return (
              <li key={e.id}>
                <Link to={`/history?event=${e.id}`} className="fp-id mono" title="Open event history">{e.id}</Link>
                <span className="fp-strip" role="img" aria-label={persistence.available ? `${persistence.active} of ${persistence.total} days with a detection` : "Historical persistence unavailable"}>
                  {obs.map((o) => <i key={o.day} className={o.active ? "on" : "off"} title={`${formatDay(o.date)}: ${o.active ? `${o.frpMw} MW` : "no detection"}`} />)}
                </span>
                <span className="fp-val mono">{persistence.available ? `${persistence.active}/${persistence.total} · ${persistence.percent}%` : "n/a"}</span>
                <PersistenceChip keyName={persistence.key} label={persistence.label} />
              </li>
            );
          })}
        </ul>
      )}
      <p className="inv-foot">{source.isLive ? `Each strip shows an event's days in the ${dataset?.historyWindowDays ?? 5}-day NASA FIRMS window, oldest to newest; filled = detection. Nothing outside that window is shown.` : "Each strip shows an event's 10 simulated observation days, oldest to newest; filled = detection."} Select an event ID to open its full history.</p>
    </>
  );
}
