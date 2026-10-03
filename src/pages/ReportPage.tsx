import { useSearchParams } from "react-router-dom";
import DataGate from "@/components/common/DataGate";
import ReportHistory from "@/components/Reports/ReportHistory";
import ReportPreview from "@/components/Reports/ReportPreview";

/** /reports lists report history; /reports?event=ID previews (and exports) the report for that event. */
function Reports() {
  const [params] = useSearchParams();
  return params.get("event") ? <ReportPreview /> : <ReportHistory />;
}
export default function ReportPage() { return <DataGate><Reports /></DataGate>; }
