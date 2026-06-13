import { useTranslations } from "next-intl";
import { getTypeTranslationKey } from "@/types/members";
import type { MembershipType } from "../types/member.types";

/**
 * S2-DEC-2 (Option A): feature-local membership-type badge — the sibling of
 * `MemberStatusBadge`. The four type colours are copied VERBATIM from the
 * god-page `getMembershipTypeColor` (members): Regular=blue,
 * Student=purple, Family=orange, Honorary=amber. Same rationale as the status
 * badge (colour as meaning, not a generic variant, not on the shared primitive),
 * same numeric | string | lowercase handling + gray fallback, same `size`
 * variants. Pinned by member-type-badge.test.tsx (A77).
 */
const NUMERIC_TYPE_CLASS: Record<number, string> = {
  0: "bg-blue-100 text-blue-800", // Regular
  1: "bg-purple-100 text-purple-800", // Student
  2: "bg-orange-100 text-orange-800", // Family
  3: "bg-amber-100 text-amber-800", // Honorary
};

const TYPE_CLASS: Record<string, string> = {
  Regular: "bg-blue-100 text-blue-800",
  Student: "bg-purple-100 text-purple-800",
  Family: "bg-orange-100 text-orange-800",
  Honorary: "bg-amber-100 text-amber-800",
  regular: "bg-blue-100 text-blue-800",
  student: "bg-purple-100 text-purple-800",
  family: "bg-orange-100 text-orange-800",
  honorary: "bg-amber-100 text-amber-800",
};

const SIZE_CLASS = {
  sm: "inline-flex px-2 py-1 text-xs font-semibold",
  md: "px-3 py-1 text-sm font-medium",
} as const;

export function memberTypeClass(
  type: MembershipType | number | string
): string {
  if (typeof type === "number") {
    return NUMERIC_TYPE_CLASS[type] ?? "bg-gray-100 text-gray-800";
  }
  return TYPE_CLASS[type] ?? "bg-gray-100 text-gray-800";
}

export function MemberTypeBadge({
  type,
  size = "sm",
}: {
  type: MembershipType | number | string;
  size?: "sm" | "md";
}) {
  const t = useTranslations();
  return (
    <span
      className={`${SIZE_CLASS[size]} rounded-full ${memberTypeClass(type)}`}
    >
      {t(`membershipType.${getTypeTranslationKey(type)}`)}
    </span>
  );
}
