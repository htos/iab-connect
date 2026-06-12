// Thin route entry (E27-S5 feature-slice migration). All api-clients admin logic
// lives in the feature slice under `@/features/admin-integrations`; this file stays a
// server entry and is NOT a client component (the composition root carries "use client").
import { ApiClientsPageContent } from "@/features/admin-integrations/components/api-clients-page-content";

export default function ApiClientsPage() {
  return <ApiClientsPageContent />;
}
