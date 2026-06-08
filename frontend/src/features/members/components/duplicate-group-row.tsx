"use client";

/**
 * REQ-018 (E2.S4): single group row on the /members/duplicates page.
 *
 * Renders one duplicate-candidate group (Exact or Likely tier) with all member summaries
 * and two action buttons:
 *   - Merge (admin-only) — opens the merge confirmation modal
 *   - Dismiss (Vorstand+) — opens the dismiss confirmation modal
 *
 * Color guardrails: orange-* primary; tier badge mirrors DuplicateWarning's palette.
 * Privacy: reuses DuplicateCandidateDto so phone/address/keycloak are never rendered.
 */

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Users, AlertOctagon, X as XIcon, ArrowRight } from "lucide-react";
import { parseMatchReason, type DuplicateGroupDto } from "@/lib/api/members";

interface DuplicateGroupRowProps {
  group: DuplicateGroupDto;
  /** Admin role gate — only admins may trigger merge. Vorstand can still dismiss. */
  isAdmin: boolean;
  onMerge: (group: DuplicateGroupDto) => void;
  onDismiss: (group: DuplicateGroupDto) => void;
}

export function DuplicateGroupRow({
  group,
  isAdmin,
  onMerge,
  onDismiss,
}: DuplicateGroupRowProps) {
  const t = useTranslations();
  const [expanded, setExpanded] = useState(true);

  const tierBadgeClasses =
    group.tier === "Exact"
      ? "bg-orange-200 text-orange-900"
      : "bg-orange-100 text-orange-800";

  const tierLabelKey =
    group.tier === "Exact"
      ? "members.duplicates.tier.exact"
      : "members.duplicates.tier.likely";

  return (
    <div
      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-5"
      data-testid={`duplicate-group-${group.groupKey}`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Users className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tierBadgeClasses}`}
              >
                {t(tierLabelKey)}
              </span>
              <span className="text-sm text-gray-600">
                {t("members.duplicates.groupSummary", {
                  count: group.members.length,
                })}
              </span>
            </div>
            <p className="mt-1 truncate text-xs text-gray-400">
              {group.groupKey}
            </p>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onDismiss(group)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            data-testid="duplicate-group-dismiss"
          >
            <XIcon className="h-4 w-4" />
            {t("members.duplicates.actions.dismiss")}
          </button>
          <button
            type="button"
            onClick={() => onMerge(group)}
            disabled={!isAdmin}
            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
            title={
              !isAdmin ? t("members.duplicates.mergeAdminOnly") : undefined
            }
            data-testid="duplicate-group-merge"
          >
            <ArrowRight className="h-4 w-4" />
            {t("members.duplicates.actions.merge")}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 text-xs text-orange-700 hover:underline"
        aria-expanded={expanded}
      >
        {expanded
          ? t("members.duplicates.collapse")
          : t("members.duplicates.expand")}
      </button>

      {expanded && (
        <ul className="mt-3 space-y-2">
          {group.members.map((candidate) => {
            const reasons = parseMatchReason(candidate.matchReason);
            return (
              <li
                key={candidate.id}
                className="flex flex-col gap-2 rounded-lg border border-orange-100 bg-orange-50/40 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-col">
                  <Link
                    href={`/members/${candidate.id}`}
                    className="truncate font-medium text-orange-700 decoration-dotted underline-offset-2 hover:underline"
                  >
                    {candidate.firstName} {candidate.lastName}
                  </Link>
                  <span className="truncate text-sm text-gray-600">
                    {candidate.email}
                  </span>
                  {reasons.length > 0 && (
                    <span className="mt-1 text-xs text-gray-500">
                      {reasons
                        .map((flag) =>
                          t(
                            `members.duplicates.reason.${flag.charAt(0).toLowerCase() + flag.slice(1)}` as never
                          )
                        )
                        .join(" • ")}
                    </span>
                  )}
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                    <AlertOctagon className="h-3 w-3" />
                    {candidate.memberSince}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
