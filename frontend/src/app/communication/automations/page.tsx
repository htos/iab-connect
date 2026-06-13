// Thin route entry (E25-S2 feature-slice extraction). All Automations list logic
// lives in the feature slice under `@/features/communication/automations`; this
// file stays a server entry and is NOT a client component.
import { AutomationsPageContent } from "@/features/communication/automations/components/automations-page-content";

export default function AutomationsPage() {
  return <AutomationsPageContent />;
}
