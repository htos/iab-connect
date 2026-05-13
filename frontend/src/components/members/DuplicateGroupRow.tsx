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
import {
  parseMatchReason,
  type DuplicateGroupDto,
} from "@/lib/api/members";

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
      className="bg-white border border-gray-200 rounded-xl p-4 md:p-5 shadow-sm"
      data-testid={`duplicate-group-${group.groupKey}`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Users className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-2">
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
            <p className="text-xs text-gray-400 mt-1 truncate">{group.groupKey}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => onDismiss(group)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            data-testid="duplicate-group-dismiss"
          >
            <XIcon className="w-4 h-4" />
            {t("members.duplicates.actions.dismiss")}
          </button>
          <button
            type="button"
            onClick={() => onMerge(group)}
            disabled={!isAdmin}
            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={!isAdmin ? t("members.duplicates.mergeAdminOnly") : undefined}
            data-testid="duplicate-group-merge"
          >
            <ArrowRight className="w-4 h-4" />
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
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-orange-50/40 border border-orange-100 rounded-lg p-3"
              >
                <div className="flex flex-col min-w-0">
                  <Link
                    href={`/members/${candidate.id}`}
                    className="text-orange-700 hover:underline underline-offset-2 decoration-dotted font-medium truncate"
                  >
                    {candidate.firstName} {candidate.lastName}
                  </Link>
                  <span className="text-sm text-gray-600 truncate">
                    {candidate.email}
                  </span>
                  {reasons.length > 0 && (
                    <span className="text-xs text-gray-500 mt-1">
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
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                    <AlertOctagon className="w-3 h-3" />
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
