import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { EmailCampaignStatus } from "../types/email-campaign.types";

// DEC (A77, mirrors sponsor-status-badge / automation-status-badge): the campaign
// status colour lives on the shared Badge primitive (semantic token variants),
// NOT the raw `getStatusColor` brand strings. The translated label
// (`status${status}`) carries the meaning so colour is never the only signal
// (a11y). The 6 transport statuses map onto the 4 Badge variants. The S1 net pins
// the TRANSLATED label + `rounded-full` (Badge provides it), not the colour class.
const STATUS_VARIANT: Record<
  EmailCampaignStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  Draft: "secondary",
  Scheduled: "outline",
  Sending: "outline",
  Sent: "default",
  Cancelled: "outline",
  Failed: "destructive",
};

export function EmailCampaignStatusBadge({
  status,
}: {
  status: EmailCampaignStatus;
}) {
  const t = useTranslations("emailCampaigns");
  return <Badge variant={STATUS_VARIANT[status]}>{t(`status${status}`)}</Badge>;
}
