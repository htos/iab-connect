// Thin route entry (E25-S4 feature-slice extraction). All Email-Templates list
// logic lives in the feature slice under `@/features/communication/email-templates`;
// this file stays a server entry and is NOT a client component.
import { EmailTemplatesPageContent } from "@/features/communication/email-templates/components/email-templates-page-content";

export default function EmailTemplatesPage() {
  return <EmailTemplatesPageContent />;
}
