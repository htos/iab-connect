import { useTranslations } from "next-intl";
import { getStatusTranslationKey } from "@/types/members";
import type { MembershipStatus } from "../types/member.types";

/**
 * S2-DEC-2 (Option A): feature-local status badge encapsulating the four status
 * colours in ONE place.
 *
 * Status colour IS the meaning (green=Active, yellow=Pending, gray=Inactive,
 * red=Suspended) — like a traffic light — so it is NOT mapped onto the four
 * generic `ui/badge` variants (that would mislabel, the A76 class) nor baked
 * into the shared `ui/badge.tsx` primitive (no domain coupling on the shared
 * leaf — the E21 rule). The colour classes are copied VERBATIM from the
 * god-page `getMembershipStatusColor` (members) so visuals do not
 * regress; this only de-scatters them. Handles numeric | string-enum |
 * lowercase input with a gray fallback, exactly like the helper it replaces.
 * A77: literal Tailwind utility classes (a documented semantic-colour
 * exception), pinned by member-status-badge.test.tsx.
 *
 * `size`: `sm` = the list table cell (px-2/text-xs/font-semibold), `md` = the
 * detail profile card (px-3/text-sm/font-medium) — both preserved verbatim.
 */
const NUMERIC_STATUS_CLASS: Record<number, string> = {
  0: "bg-yellow-100 text-yellow-800", // Pending
  1: "bg-green-100 text-green-800", // Active
  2: "bg-gray-100 text-gray-800", // Inactive
  3: "bg-red-100 text-red-800", // Suspended
};

const STATUS_CLASS: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-800",
  Active: "bg-green-100 text-green-800",
  Inactive: "bg-gray-100 text-gray-800",
  Suspended: "bg-red-100 text-red-800",
  pending: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-800",
  suspended: "bg-red-100 text-red-800",
};

const SIZE_CLASS = {
  sm: "inline-flex px-2 py-1 text-xs font-semibold",
  md: "px-3 py-1 text-sm font-medium",
} as const;

export function memberStatusClass(
  status: MembershipStatus | number | string
): string {
  if (typeof status === "number") {
    return NUMERIC_STATUS_CLASS[status] ?? "bg-gray-100 text-gray-800";
  }
  return STATUS_CLASS[status] ?? "bg-gray-100 text-gray-800";
}

export function MemberStatusBadge({
  status,
  size = "sm",
}: {
  status: MembershipStatus | number | string;
  size?: "sm" | "md";
}) {
  const t = useTranslations();
  return (
    <span
      className={`${SIZE_CLASS[size]} rounded-full ${memberStatusClass(status)}`}
    >
      {t(`status.${getStatusTranslationKey(status)}`)}
    </span>
  );
}
