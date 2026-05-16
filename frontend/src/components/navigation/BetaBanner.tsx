// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";

const DISMISSED_KEY = "iabc:beta-banner-dismissed";

function readDismissed(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.sessionStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // sessionStorage unavailable (Safari Private Browsing, blocked-by-policy) —
    // dismiss state lives in component state for the current page only. Acceptable.
  }
}

/**
 * REQ-088 (E11-S2 / ADR-015 + ux-design.md "BETA Banner"): persistent orange Beta-
 * environment banner. Renders only when `NEXT_PUBLIC_ENV_LABEL` (case-insensitive,
 * trimmed) equals `"beta"` — accepts `Beta` / `BETA` / `beta` so deployers can mirror
 * `ASPNETCORE_ENVIRONMENT=Beta` without surprise. Dismissable per session via
 * `sessionStorage` so testers can hide the banner without losing the signal on a fresh
 * tab. Feedback link uses `NEXT_PUBLIC_FEEDBACK_URL`; when unset, falls back to the
 * upstream `NEXT_PUBLIC_SOURCE_URL` issue tracker so forks redirect to their own repo
 * with no extra config (E18-S4 will land a dedicated feedback channel later).
 *
 * Mounted in the root layout above `<MainLayout>` so it appears on every route,
 * including unauthenticated screens. Coordinates with E20-S4 `<LicenseFooter />` which
 * mounts as sibling AFTER `<MainLayout>`.
 */
export function BetaBanner() {
  const envLabel = process.env.NEXT_PUBLIC_ENV_LABEL?.trim().toLowerCase();

  // Early return BEFORE hooks for non-Beta builds. `NEXT_PUBLIC_*` is build-time-baked
  // by Next.js, so the gate is consistent across renders — React allows the early return.
  if (envLabel !== "beta") {
    return null;
  }

  return <BetaBannerActive />;
}

function BetaBannerActive() {
  const t = useTranslations("beta");
  // Lazy initializer reads sessionStorage once on first render — avoids the
  // useEffect-then-setState flicker where dismissed users saw a one-frame orange
  // flash. Component is `"use client"` so it never SSRs; window is always defined
  // when this runs, but readDismissed() guards anyway.
  const [visible, setVisible] = useState(() => !readDismissed());

  if (!visible) {
    return null;
  }

  // `||` (not `??`) so empty strings and accidentally-stringified `"undefined"`
  // values from `process.env` reassignment in tests / build also trigger fallback.
  const sourceUrl =
    process.env.NEXT_PUBLIC_SOURCE_URL || "https://github.com/htos/iab-connect";
  const feedbackUrl =
    process.env.NEXT_PUBLIC_FEEDBACK_URL ||
    `${sourceUrl}/issues/new?template=beta-feedback.md`;

  const handleDismiss = () => {
    setVisible(false);
    writeDismissed();
  };

  return (
    <div
      role="status"
      aria-label={t("ariaLabel")}
      className="flex w-full flex-wrap items-center justify-between gap-2 bg-orange-500 px-4 py-2 text-sm text-white"
    >
      <span>{t("bannerMessage")}</span>
      <div className="flex items-center gap-3">
        <a
          href={feedbackUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:no-underline"
        >
          {t("feedbackLink")}
        </a>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t("dismissAriaLabel")}
          className="rounded p-1 hover:bg-orange-600 focus:ring-2 focus:ring-white focus:outline-none"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
