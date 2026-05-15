"use client";

/**
 * REQ-087 (E10-S5): the neutral "site not public" page shown when the `public_view`
 * module is disabled. `middleware.ts` rewrites `/public/*` and the unauthenticated `/`
 * here (OD-5: a neutral page, not a login redirect).
 *
 * Standalone minimal layout — `MainLayout` lists `/site-unavailable` as a full-page route,
 * so there is no authenticated shell and no public header/footer. Branding is read from
 * the still-reachable anonymous `GET /api/v1/settings/public`; if that fetch fails the
 * page renders a plain unbranded message and never errors out.
 */
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

interface Branding {
  applicationName: string;
  logoUrl: string | null;
  logoText: string;
  logoBackgroundColor: string;
  logoTextColor: string;
}

export default function SiteUnavailablePage() {
  const t = useTranslations("siteUnavailable");
  const [branding, setBranding] = useState<Branding | null>(null);
  const loginRef = useRef<HTMLAnchorElement>(null);

  // Self-contained branding fetch — `null` (initial or on failure) renders the plain
  // unbranded fallback. Errors are swallowed; the core message + login link always render.
  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
    fetch(`${baseUrl}/api/v1/settings/public`)
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error("fetch failed"))
      )
      .then((data) =>
        setBranding({
          applicationName: data.applicationName ?? "",
          logoUrl: data.logoUrl ? `${baseUrl}${data.logoUrl}` : null,
          logoText: data.logoText ?? "",
          logoBackgroundColor: data.logoBackgroundColor ?? "#EA580C",
          logoTextColor: data.logoTextColor ?? "#FFFFFF",
        })
      )
      .catch((err) => {
        // Round-2 [Review][Patch] (P-S5-5): a silent swallow hid misconfigured
        // NEXT_PUBLIC_API_URL deployments. Warn so the operator sees the cause in
        // devtools / log aggregation instead of just "the unbranded fallback".
        console.warn(
          "[SiteUnavailablePage] Failed to fetch branding from /api/v1/settings/public — rendering the unbranded fallback. Check NEXT_PUBLIC_API_URL and that the API is reachable.",
          err
        );
        setBranding(null);
      });
  }, []);

  // Focus the login link on load — a sensible keyboard starting point, not a trap.
  useEffect(() => {
    loginRef.current?.focus();
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6 text-center">
      <div className="w-full max-w-md">
        {branding && (
          <div className="mb-6 flex flex-col items-center gap-3">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt={branding.applicationName}
                className="h-16 w-auto"
              />
            ) : (
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold"
                style={{
                  backgroundColor: branding.logoBackgroundColor,
                  color: branding.logoTextColor,
                }}
              >
                {branding.logoText}
              </div>
            )}
            {branding.applicationName && (
              <p className="text-lg font-semibold text-gray-900">
                {branding.applicationName}
              </p>
            )}
          </div>
        )}

        <h1 className="text-xl font-bold text-gray-900">{t("heading")}</h1>
        <p className="mt-2 text-gray-600">{t("body")}</p>

        <Link
          ref={loginRef}
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-orange-600 transition-colors hover:text-orange-700 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:outline-none"
        >
          {t("memberLogin")}
        </Link>
      </div>
    </main>
  );
}
