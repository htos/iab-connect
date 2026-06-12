"use client";

/**
 * Communication INDEX page content (REQ-026, E25-S4). Feature-slice composition
 * root rendered by the thin `communication/page.tsx` route entry. Central hub for
 * email campaigns, templates, and automations.
 *
 * Behaviour preserved verbatim (pinned by the E25-S1 index characterization net):
 *   - `isLoading` → spinner;
 *   - the REDIRECT guard `!isAuthenticated || (!isAdmin && !isVorstand)` →
 *     `router.push("/")` (in a useEffect) + `return null` — DISTINCT from the
 *     new/[id] pages' silent-null;
 *   - 3 nav `<Link>` cards (email-campaigns / email-templates / automations) + 2
 *     quick-action `<Link>`s (email-campaigns/new, email-templates/new) with their
 *     exact hrefs.
 *
 * NOTE: lives in the email-templates slice (the LAST E25 slice) as the natural home
 * for the Communication index now that all 3 sub-modules are sliced.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import Link from "next/link";

// Icons as components
const EmailCampaignIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
    />
  </svg>
);

const EmailTemplateIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

const AutomationIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 10V3L4 14h7v7l9-11h-7z"
    />
  </svg>
);

const ChevronRightIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5l7 7-7 7"
    />
  </svg>
);

export function CommunicationIndexContent() {
  const t = useTranslations("communication");
  const router = useRouter();
  const { isAuthenticated, isLoading, isAdmin, isVorstand } = useAuth();

  // Redirect if not authorized
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || (!isAdmin && !isVorstand))) {
      router.push("/");
    }
  }, [isLoading, isAuthenticated, isAdmin, isVorstand, router]);

  if (isLoading) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex min-h-100 items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated || (!isAdmin && !isVorstand)) {
    return null;
  }

  const communicationSections = [
    {
      href: "/communication/email-campaigns",
      titleKey: "emailCampaigns.title",
      descriptionKey: "emailCampaigns.description",
      icon: EmailCampaignIcon,
    },
    {
      href: "/communication/email-templates",
      titleKey: "emailTemplates.title",
      descriptionKey: "emailTemplates.description",
      icon: EmailTemplateIcon,
    },
    {
      href: "/communication/automations",
      titleKey: "automations.title",
      descriptionKey: "automations.description",
      icon: AutomationIcon,
    },
  ];

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
              {t("title")}
            </h1>
            <p className="mt-1 text-gray-600">{t("subtitle")}</p>
          </div>
        </div>

        {/* Communication Cards Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2">
          {communicationSections.map((section) => {
            const IconComponent = section.icon;
            return (
              <Link
                key={section.href}
                href={section.href}
                className="group rounded-xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div className="rounded-xl bg-orange-100 p-3">
                    <IconComponent className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 transition-colors group-hover:text-orange-600">
                      {t(section.titleKey)}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      {t(section.descriptionKey)}
                    </p>
                  </div>
                  <ChevronRightIcon className="mt-1 h-5 w-5 shrink-0 text-gray-400 transition-colors group-hover:text-orange-600" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            {t("quickActions.title")}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link
              href="/communication/email-campaigns/new"
              className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="rounded-lg bg-green-100 p-2">
                <svg
                  className="h-5 w-5 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </div>
              <span className="font-medium text-gray-900">
                {t("quickActions.newCampaign")}
              </span>
            </Link>
            <Link
              href="/communication/email-templates/new"
              className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="rounded-lg bg-blue-100 p-2">
                <svg
                  className="h-5 w-5 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </div>
              <span className="font-medium text-gray-900">
                {t("quickActions.newTemplate")}
              </span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
