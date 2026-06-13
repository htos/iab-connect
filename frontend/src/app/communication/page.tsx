// Thin route entry (E25-S4 feature-slice extraction). The Communication INDEX hub
// logic lives in the feature slice under `@/features/communication/email-templates`;
// this file stays a server entry and is NOT a client component.
import { CommunicationIndexContent } from "@/features/communication/email-templates/components/communication-index-content";

export default function CommunicationPage() {
  return <CommunicationIndexContent />;
}
