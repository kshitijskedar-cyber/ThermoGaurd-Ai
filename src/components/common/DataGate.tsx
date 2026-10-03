import type { ReactNode } from "react";
import { useThermalData } from "@/hooks/useThermalData";
import StateBlock from "./StateBlock";

/** Renders loading / error / empty states so pages never show a blank screen. */
export default function DataGate({ children }: { children: ReactNode }) {
  const { status, dataset, reload, source } = useThermalData();
  if (status === "loading") return <StateBlock variant="loading" title="Loading thermal observations..." detail="Loading the dataset. Live mode contacts NASA FIRMS and OpenStreetMap, which can take a few seconds." />;
  if (status === "error" || !dataset)
    return <StateBlock variant="error" title="Unable to retrieve satellite data." detail="The dataset could not be loaded. Check your connection and try again." action={{ label: "Retry", onClick: reload }} />;
  if (dataset.events.length === 0)
    return source.isLive
      ? <StateBlock variant="empty" icon="flame" title="NASA FIRMS reported no thermal anomalies for the configured area."
          detail={`No observations were returned for ${dataset.live?.firms?.regionLabel ?? "the configured area"} in the last ${dataset.live?.firms?.dayRange ?? "few"} day(s). Refresh later, or widen the area with VITE_FIRMS_BBOX.`}
          action={{ label: "Refresh", onClick: reload }} />
      : <StateBlock variant="empty" icon="flame" title="No thermal anomalies match the selected filters." detail="Clear or relax the active filters to see events again." />;
  return <>{children}</>;
}
