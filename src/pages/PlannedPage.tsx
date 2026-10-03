import { useSearchParams } from "react-router-dom";
import StateBlock from "@/components/common/StateBlock";
import type { IconName } from "@/components/common/Icon";

interface Props { icon: IconName; phase: number; summary: string }

/** Route placeholder for screens scheduled for a later build phase. Honest empty state, no fake content. */
export default function PlannedPage({ icon, phase, summary }: Props) {
  const [params] = useSearchParams();
  const event = params.get("event");
  return (
    <StateBlock
      variant="planned" icon={icon} title={`Planned for Phase ${phase}`}
      detail={<>{summary}{event && <> Selected event: <b className="mono">{event}</b>.</>}</>}
    />
  );
}
