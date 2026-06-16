// Thin route entry (E25-S3). All detail logic lives in the feature slice; the
// slice content reads the `id` via `useParams()` itself (the S1 spec mocks it), so
// this entry stays trivial and is NOT a client component.
import { EmailCampaignDetail } from "@/features/communication/email-campaigns/components/email-campaign-detail";

export default function EmailCampaignDetailPage() {
  return <EmailCampaignDetail />;
}
