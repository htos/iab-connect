// Thin route entry (E27-S5 feature-slice migration). All webhooks admin logic lives
// in the feature slice under `@/features/admin-integrations`; this file stays a
// server entry (the composition root carries "use client").
import { WebhooksPageContent } from "@/features/admin-integrations/components/webhooks-page-content";

export default function WebhooksPage() {
  return <WebhooksPageContent />;
}
