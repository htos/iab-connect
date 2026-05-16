// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";

const DISMISSED_KEY = "iabc:beta-banner-dismissed";

/**
 * REQ-088 (E11-S2 / ADR-015 + ux-design.md "BETA Banner"): persistent orange Beta-
 * environment banner. Renders only when `NEXT_PUBLIC_ENV_LABEL === "beta"`. Dismissable
 * per session via `sessionStorage` so testers can hide the banner without losing the
 * signal on a fresh tab. Feedback link uses `NEXT_PUBLIC_FEEDBACK_URL` with a
 * GitHub-issue-template default (the template itself is the deliverable of E18-S4 —
 * the link still works without a template, GitHub falls back to the standard issue form).
 *
 * Mounted in the root layout above `<MainLayout>` so it appears on every route,
 * including unauthenticated screens. Coordinates with E20-S4 `<LicenseFooter />` which
 * mounts as sibling AFTER `<MainLayout>`.
 */
export function BetaBanner() {
  const envLabel = process.env.NEXT_PUBLIC_ENV_LABEL;

  // Early return BEFORE hooks for non-Beta builds. `NEXT_PUBLIC_*` is build-time-baked
  // by Next.js, so the gate is consistent across renders — React allows the early return.
  if (envLabel !== "beta") {
    return null;
  }

  return <BetaBannerActive />;
}

function BetaBannerActive() {
  const t = useTranslations("beta");
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Sync with sessionStorage on mount. SSR cannot read sessionStorage, so we
    // initialise visible=true (safe default) and reconcile on the client. Lint
    // disable: react-hooks/set-state-in-effect doesn't have a non-mismatch-prone
    // alternative for Next.js SSR — useState lazy init would read undefined on
    // server and the dismissed-flag on client, causing a hydration mismatch.
    if (
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(DISMISSED_KEY) === "1"
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with sessionStorage on mount (no SSR-safe alternative)
      setVisible(false);
    }
  }, []);

  if (!visible) {
    return null;
  }

  const feedbackUrl =
    process.env.NEXT_PUBLIC_FEEDBACK_URL ??
    "https://github.com/htos/iab-connect/issues/new?template=beta-feedback.md";

  const handleDismiss = () => {
    setVisible(false);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(DISMISSED_KEY, "1");
    }
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
          className="rounded p-1 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-white"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
