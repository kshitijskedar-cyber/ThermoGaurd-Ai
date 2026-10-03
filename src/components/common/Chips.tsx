import type { AlertStatus, FacilityPersistenceKey, FacilityRiskStatus, PersistenceKey } from "@/types/intelligence";
import { RISK_LABEL } from "@/utils/format";
import { STATUS_LABEL } from "@/services/intelligence/alerts";

export function AlertStatusChip({ status }: { status: AlertStatus }) {
  return <span className={`chip status-${status}`}>{STATUS_LABEL[status]}</span>;
}

export function PersistenceChip({ keyName, label }: { keyName: PersistenceKey | FacilityPersistenceKey; label: string }) {
  return <span className={`chip pers-${keyName}`}>{label}</span>;
}

/** Facility risk badge: the four risk levels plus NORMAL when no open event remains. Reuses the Phase 2 risk-badge styling. */
export function RiskStatusBadge({ status }: { status: FacilityRiskStatus }) {
  return <span className={`risk-badge ${status === "normal" ? "low" : status}`}>{status === "normal" ? "NORMAL" : RISK_LABEL[status]}</span>;
}
