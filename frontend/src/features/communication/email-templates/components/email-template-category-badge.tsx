import { Badge } from "@/components/ui/badge";

/**
 * Category badge for an email template (E25-S4, DEC mirrors sponsor-status-badge /
 * automation-status-badge). The god-page rendered the raw `category` value inside a
 * hand-written `bg-gray-100 text-gray-800 rounded-full` pill; here it lives on the
 * shared `Badge` primitive (semantic token variant), with the category value shown
 * VERBATIM (NOT i18n — the S1 net asserts the raw category text, e.g. "WelcomeCat").
 * Variant mapping (A77 — semantic tokens only, no raw brand strings): the category
 * is the LIGHT pill (god-page `bg-gray-100 text-gray-800`) → `outline` (light /
 * bordered). The inactive marker (card) uses the filled `secondary` so the two
 * remain visually DISTINCT (the god-page's darker `bg-gray-500 text-white`). `Badge`
 * provides `rounded-full`.
 */
export function EmailTemplateCategoryBadge({ category }: { category: string }) {
  return <Badge variant="outline">{category}</Badge>;
}
