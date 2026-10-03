import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useThermalData } from "./useThermalData";

/** Resolves the event for investigation / history / report screens: `?event=` wins, then the dashboard selection. */
export function useSelectedEvent() {
  const { dataset, assessments, selectedId, select } = useThermalData();
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get("event");
  const urlValid = !!fromUrl && !!dataset?.events.some((e) => e.id === fromUrl);

  useEffect(() => { if (urlValid && fromUrl !== selectedId) select(fromUrl); }, [urlValid, fromUrl, selectedId, select]);

  const id = fromUrl ? (urlValid ? fromUrl : null) : selectedId;
  const event = dataset?.events.find((e) => e.id === id) ?? null;
  const setEvent = (next: string) => { select(next); setParams({ event: next }, { replace: true }); };
  return {
    dataset, event, setEvent,
    unknownEventParam: !!fromUrl && !urlValid,
    assessment: event ? assessments[event.id] ?? null : null,
    history: event && dataset ? dataset.history[event.id] ?? [] : [],
  };
}
