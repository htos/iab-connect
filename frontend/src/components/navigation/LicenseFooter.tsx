// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

/**
 * REQ-089 AC-4 (E20-S4) / ADR-021: universal slim license footer rendered on EVERY route
 * (authenticated, anonymous, public marketing) so AGPL §13 source-disclosure is satisfied
 * without depending on which layout the page chose. Three pieces of disclosure:
 *
 *   IAB Connect · AGPL-3.0-or-later · Source
 *
 * - `IAB Connect` is the hard-coded upstream identifier (NOT `applicationName`, which is
 *   admin-editable per REQ-086 — see E20-S3 / AboutEndpoints.cs for the same rationale).
 * - License link routes internally to `/public/license`, which embeds the LICENSE text.
 * - Source link is the canonical upstream GitHub repository (or the fork-overridden URL
 *   from `NEXT_PUBLIC_SOURCE_URL`). External anchor, opens in new tab.
 *
 * Mounted at the root layout AFTER `<MainLayout>` so it appears below every page.
 * Coordinates with `<BetaBanner />` (E11-S2) which mounts ABOVE `<MainLayout>`.
 */
export function LicenseFooter() {
  const t = useTranslations("licenseFooter");

  // `||` (not `??`) so empty strings and accidentally-stringified `"undefined"` values
  // from `process.env` reassignment in tests / build also trigger fallback. Matches
  // BetaBanner.tsx:73-77 precedent.
  const sourceUrl =
    process.env.NEXT_PUBLIC_SOURCE_URL || "https://github.com/htos/iab-connect";

  return (
    <footer
      role="contentinfo"
      aria-label={t("ariaLabel")}
      className="border-t border-gray-200 bg-gray-100 text-xs text-gray-600"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-2 px-4 py-2 sm:px-6 md:gap-4 lg:px-8">
        <span>{t("projectName")}</span>
        <span aria-hidden="true">·</span>
        <Link
          href="/public/license"
          className="text-orange-600 hover:underline"
        >
          {t("licenseLabel")}
        </Link>
        <span aria-hidden="true">·</span>
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-orange-600 hover:underline"
        >
          {t("sourceLabel")}
        </a>
      </div>
    </footer>
  );
}
