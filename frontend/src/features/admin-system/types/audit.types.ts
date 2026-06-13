// Audit resource types (E27-S4). The DTO shapes live in `audit` (the
// transport we WRAP per DEC-1=A); re-exporting them here keeps the slice's
// hooks/components decoupled from the raw lib path — no component imports
// `*` directly.
export type {
  AuditEvent,
  AuditEventListResponse,
  AuditCategory,
  AuditEventType,
  AuditFilterOptions,
} from "../api/audit";
