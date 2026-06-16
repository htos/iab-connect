import { Badge } from "@/components/ui/badge";
import type { EmailRecipientStatus } from "../types/email-campaign.types";

// DEC (A77): recipient status colour lives on the shared Badge primitive
// (semantic token variants), NOT the raw `getRecipientStatusColor` brand strings.
// The god-page rendered the recipient status label RAW (NOT i18n) inside the
// colored pill, so we keep the raw `status` text (the S1 net asserts the raw
// label + `rounded-full`, which Badge provides). The 10 recipient statuses map
// onto the 4 Badge variants.
const RECIPIENT_VARIANT: Record<
  EmailRecipientStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  Pending: "secondary",
  Queued: "secondary",
  Sent: "outline",
  Delivered: "default",
  Opened: "default",
  Clicked: "default",
  Bounced: "outline",
  Failed: "destructive",
  Unsubscribed: "outline",
  Skipped: "secondary",
};

export function EmailCampaignRecipientBadge({
  status,
}: {
  status: EmailRecipientStatus;
}) {
  return <Badge variant={RECIPIENT_VARIANT[status]}>{status}</Badge>;
}
