// Thin route entry (E25-S3 feature-slice extraction). All Email-Campaigns list
// logic lives in the feature slice under `@/features/communication/email-campaigns`;
// this file stays a server entry and is NOT a client component.
import { EmailCampaignsPageContent } from "@/features/communication/email-campaigns/components/email-campaigns-page-content";

export default function EmailCampaignsPage() {
  return <EmailCampaignsPageContent />;
}
