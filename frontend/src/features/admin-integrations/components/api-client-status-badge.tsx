import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

// DEC-2 (E27-S5, A77): the api-client active/revoked status colour moves from raw
// Tailwind text-colour spans onto the shared Badge primitive (semantic token
// variants). `default` carries the active (primary) accent; `destructive` the
// revoked (red) state (A86 — revoked stays red). The translated label carries the
// meaning so colour is never the only signal (a11y). The label keys
// (`active`/`revoked`) are preserved verbatim from the god-page.
export function ApiClientStatusBadge({ isRevoked }: { isRevoked: boolean }) {
  const t = useTranslations("admin.apiClients");
  return (
    <Badge variant={isRevoked ? "destructive" : "default"}>
      {isRevoked ? t("revoked") : t("active")}
    </Badge>
  );
}
