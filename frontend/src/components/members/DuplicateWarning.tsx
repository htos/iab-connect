"use client";

/**
 * REQ-018 (E2.S2): Pre-submit duplicate-candidate warning for the member create/edit forms.
 *
 * Privacy surface (AC-6): firstName, lastName, email, membershipStatus, memberSince,
 * matchTier, matchReason ONLY. Phone/address/keycloak fields MUST NOT be rendered.
 *
 * Color guardrail (docs/13_frontend_design_standards.md): orange-* for advisory; red is
 * reserved for fatal errors elsewhere in the form.
 */

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  parseMatchReason,
  type DuplicateCandidateDto,
} from "@/lib/api/members";

interface DuplicateWarningProps {
  candidates: DuplicateCandidateDto[];
  /** True when at least one candidate is `Exact` — submit must be hard-blocked. */
  hasExactMatch: boolean;
  /** True when only `Likely` candidates exist — render the "save anyway" confirm control. */
  confirmRequired: boolean;
  /** Fires when the admin clicks "save anyway". Only relevant when `confirmRequired` is true. */
  onConfirmProceed?: () => void;
  /** Loading indicator while the duplicate-check fetch is in flight. */
  loading?: boolean;
}

export function DuplicateWarning({
  candidates,
  hasExactMatch,
  confirmRequired,
  onConfirmProceed,
  loading = false,
}: DuplicateWarningProps) {
  const t = useTranslations();

  if (candidates.length === 0 && !loading) {
    return null;
  }

  const subtitleKey = hasExactMatch
    ? "members.duplicateWarning.subtitle.exactMatch"
    : "members.duplicateWarning.subtitle.likelyMatch";

  return (
    <div
      role="alert"
      className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6"
      data-testid="duplicate-warning"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-orange-800">
              {t("members.duplicateWarning.title")}
            </h3>
            {loading && (
              <span
                className="inline-block w-3 h-3 border-2 border-orange-400 border-t-transparent rounded-full animate-spin"
                aria-hidden="true"
              />
            )}
          </div>
          {candidates.length > 0 && (
            <p className="text-sm text-orange-700 mt-1">{t(subtitleKey)}</p>
          )}

          {candidates.length > 0 && (
            <ul className="mt-3 space-y-2">
              {candidates.map((candidate) => {
                const reasons = parseMatchReason(candidate.matchReason);
                const tierKey =
                  candidate.matchTier === "Exact"
                    ? "members.duplicateWarning.tier.exact"
                    : "members.duplicateWarning.tier.likely";
                const tierBadgeClasses =
                  candidate.matchTier === "Exact"
                    ? "bg-orange-200 text-orange-900"
                    : "bg-orange-100 text-orange-800";

                return (
                  <li
                    key={candidate.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-white border border-orange-100 rounded-lg p-3"
                  >
                    <div className="flex flex-col">
                      <Link
                        href={`/members/${candidate.id}`}
                        className="text-orange-700 hover:underline underline-offset-2 decoration-dotted font-medium"
                      >
                        {candidate.firstName} {candidate.lastName}
                      </Link>
                      <span className="text-sm text-gray-600">
                        {candidate.email}
                      </span>
                      {reasons.length > 0 && (
                        <span className="text-xs text-gray-500 mt-1">
                          {reasons
                            .map((flag) =>
                              t(
                                `members.duplicateWarning.reason.${flag.charAt(0).toLowerCase() + flag.slice(1)}` as never
                              )
                            )
                            .join(" • ")}
                        </span>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tierBadgeClasses}`}
                    >
                      {t(tierKey)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {hasExactMatch && (
            <p className="text-sm font-medium text-orange-800 mt-3">
              {t("members.duplicateWarning.blocked")}
            </p>
          )}

          {confirmRequired && !hasExactMatch && onConfirmProceed && (
            <button
              type="button"
              onClick={onConfirmProceed}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-orange-300 bg-white px-3 py-1.5 text-sm font-medium text-orange-700 hover:bg-orange-100 transition-colors"
              data-testid="duplicate-warning-confirm"
            >
              {t("members.duplicateWarning.confirmProceed")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
