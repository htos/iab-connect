import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { SupplierStatus } from "../types/supplier.types";

// DEC-2 (E21-S1): status colours live on the shared Badge primitive (semantic
// token variants), NOT raw Tailwind colour classes in the feature. The four
// statuses map onto the four available variants; the label text (translated)
// carries the meaning so colour is never the only signal (a11y). A richer set
// of semantic status tokens (success/warning/info) is a future theming add-on,
// out of pilot scope.
const STATUS_VARIANT: Record<
  SupplierStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  Active: "default",
  Prospect: "secondary",
  Paused: "outline",
  Ended: "destructive",
};

export function SupplierStatusBadge({ status }: { status: SupplierStatus }) {
  const t = useTranslations();
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      {t(`suppliers.status.${status}`)}
    </Badge>
  );
}
