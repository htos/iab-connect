"use client";

/**
 * Module-unavailable content (E30-S2 features/system slice).
 *
 * REQ-087 (E10-S4): shown when a user lands on a disabled-module route — either via
 * the middleware rewrite (direct URL) or by following a stale link/bookmark. UX-only;
 * the backend 403 from E10-S3 is the real control. Renders inside the authenticated
 * shell — MainLayout adds Header + Sidebar for any route not under /public or /login.
 *
 * E30-S2: the inline `<main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
 * <div className="mx-auto max-w-4xl">` frame is now the shared `<PageShell maxWidth="4xl">`
 * primitive (E30-S1) — byte-identical DOM. The mount-focus effect stays here (PageShell
 * is a passive frame). This is the ONLY E30-S2 page that adopts PageShell.
 */
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { PackageX } from "lucide-react";
import { PageShell } from "@/components/layout";

export function ModuleUnavailableContent() {
  const t = useTranslations("moduleUnavailable");
  const backButtonRef = useRef<HTMLAnchorElement>(null);

  // Move focus to the primary action on load — a sensible starting point for keyboard
  // users, and explicitly not a keyboard trap (it is a normal link).
  useEffect(() => {
    backButtonRef.current?.focus();
  }, []);

  return (
    <PageShell maxWidth="4xl">
      <div className="rounded-xl bg-white p-8 shadow-sm md:p-12">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 rounded-full bg-orange-100 p-4">
            <PackageX
              className="h-10 w-10 text-orange-600"
              aria-hidden="true"
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
            {t("heading")}
          </h1>
          <p className="mt-3 max-w-prose text-gray-600">{t("body")}</p>
          <p className="mt-2 max-w-prose text-sm text-gray-500">
            {t("adminHint")}
          </p>
          <Link
            ref={backButtonRef}
            href="/"
            className="mt-8 rounded-lg bg-orange-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:outline-none"
          >
            {t("backToDashboard")}
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
