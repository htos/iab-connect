// Thin route entry (E27-S4 feature-slice migration). All Audit Log logic lives in
// the feature slice under `@/features/admin-system`; this file stays a server entry
// and is NOT a client component.
import { AuditPageContent } from "@/features/admin-system/components/audit-page-content";

export default function AuditPage() {
  return <AuditPageContent />;
}
