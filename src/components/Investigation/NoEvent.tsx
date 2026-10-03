import { Link } from "react-router-dom";
import StateBlock from "@/components/common/StateBlock";

export default function NoEvent({ unknown }: { unknown?: boolean }) {
  return (
    <>
      <StateBlock variant="empty" icon="scan" title={unknown ? "That thermal event was not found" : "No thermal event selected"}
        detail={unknown ? "The event ID in the link does not exist in the loaded dataset." : "Select an event on the Thermal Map or in the detection feed, then choose AI INVESTIGATE."} />
      <div style={{ textAlign: "center" }}><Link className="primary-action link-btn" to="/map">Open Thermal Map</Link></div>
    </>
  );
}
