// Thin route entry (E25-S3). All edit logic lives in the feature slice; the slice
// content reads the `id` via `useParams()` itself (the S1 spec mocks it), so this
// entry stays trivial and is NOT a client component.
import { EmailCampaignEditContent } from "@/features/communication/email-campaigns/components/email-campaign-edit-content";

export default function EditEmailCampaignPage() {
  return <EmailCampaignEditContent />;
}
