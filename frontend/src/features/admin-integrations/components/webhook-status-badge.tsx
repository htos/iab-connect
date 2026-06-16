import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

// DEC-2 (E27-S5, A77): the webhook active/disabled status colour moves onto the
// shared Badge primitive. `Active` → `default` (primary accent); any other status
// (the god-page treated everything non-"Active" as disabled) → `secondary` (the
// muted/gray equivalent of the god-page's gray text). The translated label
// (`active`/`disabled`) carries the meaning so colour is never the only signal.
export function WebhookStatusBadge({ status }: { status: string }) {
  const t = useTranslations("admin.webhooks");
  const isActive = status === "Active";
  return (
    <Badge variant={isActive ? "default" : "secondary"}>
      {isActive ? t("active") : t("disabled")}
    </Badge>
  );
}
