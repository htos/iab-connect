// Thin route entry (E27-S4 feature-slice migration). All System Health logic lives
// in the feature slice under `@/features/admin-system`; this file stays a server
// entry and is NOT a client component.
import { HealthPageContent } from "@/features/admin-system/components/health-page-content";

export default function HealthPage() {
  return <HealthPageContent />;
}
