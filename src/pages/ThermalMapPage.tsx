import DataGate from "@/components/common/DataGate";
import MapWorkspace from "@/components/Map/MapWorkspace";

export default function ThermalMapPage() {
  return (
    <DataGate>
      <MapWorkspace variant="full" />
    </DataGate>
  );
}
