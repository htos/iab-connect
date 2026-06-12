// Thin route entry (E27-S4 feature-slice migration). All Retention Policies logic
// lives in the feature slice under `@/features/admin-system`; this file stays a
// server entry and is NOT a client component.
import { RetentionPageContent } from "@/features/admin-system/components/retention-page-content";

export default function RetentionPage() {
  return <RetentionPageContent />;
}
