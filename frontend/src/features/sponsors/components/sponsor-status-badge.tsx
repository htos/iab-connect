import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { SponsorStatus } from "../types/sponsor.types";

// DEC-2 (E21-S1): status colours live on the shared Badge primitive (semantic
// token variants), NOT raw Tailwind colour classes in the feature. The four
// statuses map onto the four available variants; the translated label carries the
// meaning so colour is never the only signal (a11y). Mirrors
// `supplier-status-badge.tsx`. A richer set of semantic status tokens
// (success/warning/info) is a future theming add-on, out of scope here.
const STATUS_VARIANT: Record<
  SponsorStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  Active: "default",
  Prospect: "secondary",
  Paused: "outline",
  Ended: "destructive",
};

export function SponsorStatusBadge({ status }: { status: SponsorStatus }) {
  const t = useTranslations();
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      {t(`sponsors.status.${status}`)}
    </Badge>
  );
}
