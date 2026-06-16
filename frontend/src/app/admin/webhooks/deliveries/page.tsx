// Thin route entry (E27-S5 feature-slice migration). All webhook-delivery admin logic
// lives in the feature slice under `@/features/admin-integrations`; this file stays a
// server entry (the composition root carries "use client").
import { WebhookDeliveriesPageContent } from "@/features/admin-integrations/components/webhook-deliveries-page-content";

export default function WebhookDeliveriesPage() {
  return <WebhookDeliveriesPageContent />;
}
