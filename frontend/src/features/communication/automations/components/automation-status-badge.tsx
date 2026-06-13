import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { AutomationStatus } from "../types/automation.types";

// DEC-4 (E25-S2): status colours live on the shared Badge primitive (semantic
// token variants), NOT raw `getStatusColor` brand strings in the feature. The
// four statuses map onto the four available variants; the translated label
// (`status${status}`) carries the meaning so colour is never the only signal
// (a11y). Mirrors `sponsor-status-badge.tsx`. A77: the variants resolve to
// semantic tokens — no hand-written Tailwind colour classes here.
const STATUS_VARIANT: Record<
  AutomationStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  Draft: "secondary",
  Active: "default",
  Paused: "outline",
  Disabled: "destructive",
};

export function AutomationStatusBadge({
  status,
}: {
  status: AutomationStatus;
}) {
  const t = useTranslations("automations");
  return <Badge variant={STATUS_VARIANT[status]}>{t(`status${status}`)}</Badge>;
}
