import DataGate from "@/components/common/DataGate";
import EventFeed from "@/components/Dashboard/EventFeed";
import KpiGrid from "@/components/Dashboard/KpiGrid";
import PriorityAlerts from "@/components/Dashboard/PriorityAlerts";
import MapWorkspace from "@/components/Map/MapWorkspace";

export default function OverviewPage() {
  return (
    <DataGate>
      <KpiGrid />
      <PriorityAlerts />
      <MapWorkspace variant="overview" />
      <EventFeed />
    </DataGate>
  );
}
