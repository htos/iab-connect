// Thin route entry (E27-S4 feature-slice migration). All Backup Management logic
// lives in the feature slice under `@/features/admin-system`; this file stays a
// server entry and is NOT a client component.
import { BackupsPageContent } from "@/features/admin-system/components/backups-page-content";

export default function BackupsPage() {
  return <BackupsPageContent />;
}
