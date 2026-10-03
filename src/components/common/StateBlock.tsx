import type { ReactNode } from "react";
import Icon, { type IconName } from "./Icon";

interface Props {
  variant: "loading" | "error" | "empty" | "planned";
  title: string;
  detail?: ReactNode;
  icon?: IconName;
  action?: { label: string; onClick: () => void };
}

export default function StateBlock({ variant, title, detail, icon, action }: Props) {
  return (
    <div className={`state-block ${variant}`} role={variant === "error" ? "alert" : "status"} aria-live="polite">
      {variant === "loading" ? <span className="spinner" aria-hidden="true" /> : <span className="state-icon"><Icon name={icon ?? "satellite"} size={22} /></span>}
      <strong>{title}</strong>
      {detail && <p>{detail}</p>}
      {action && <button className="secondary-action" onClick={action.onClick}>{action.label}</button>}
    </div>
  );
}
