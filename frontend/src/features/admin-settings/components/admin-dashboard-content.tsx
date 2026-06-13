"use client";

/**
 * Admin Dashboard content (E27-S3 feature-slice migration of `app/admin/page.tsx`).
 * REQ-004 (Administration) / REQ-011 (Audit Log access).
 *
 * Genuinely static navigation — no data fetch (the skeleton's "hooks-light" note was
 * correct). The composition root rendered by the thin `app/admin/page.tsx` entry; this
 * is the only `"use client"` boundary for the dashboard. Markup, the 7 tiles
 * (label key + href), the Quick-Info block, and the admin auth guard
 * (`router.push("/")` + `return null`) are preserved verbatim (pinned by the E27-S1
 * `admin/page.test.tsx` net).
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageShell, PageHeader } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import Link from "next/link";

// Icons as components
const UsersIcon = ({ className }: { className?: string }) => (
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
      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
    />
  </svg>
);

const AuditIcon = ({ className }: { className?: string }) => (
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
      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
    />
  </svg>
);

const SettingsIcon = ({ className }: { className?: string }) => (
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
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

const BackupIcon = ({ className }: { className?: string }) => (
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
      d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
    />
  </svg>
);

const RetentionIcon = ({ className }: { className?: string }) => (
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
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const HealthIcon = ({ className }: { className?: string }) => (
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
      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
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

export function AdminDashboardContent() {
  const t = useTranslations("admin");
  const router = useRouter();
  const { isAuthenticated, isLoading, isAdmin } = useAuth();

  // Redirect if not admin
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/");
    }
  }, [isLoading, isAuthenticated, isAdmin, router]);

  if (isLoading) {
    return (
      <PageShell>
        <div className="flex min-h-100 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
        </div>
      </PageShell>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  const adminSections = [
    {
      href: "/admin/users",
      titleKey: "users.title",
      descriptionKey: "users.description",
      icon: UsersIcon,
    },
    {
      href: "/admin/audit",
      titleKey: "audit.title",
      descriptionKey: "audit.description",
      icon: AuditIcon,
    },
    {
      href: "/admin/register",
      titleKey: "register.title",
      descriptionKey: "register.description",
      icon: EmailTemplateIcon,
    },
    {
      href: "/admin/settings",
      titleKey: "settings.title",
      descriptionKey: "settings.description",
      icon: SettingsIcon,
    },
    {
      href: "/admin/backups",
      titleKey: "backups.title",
      descriptionKey: "backups.description",
      icon: BackupIcon,
    },
    {
      href: "/admin/retention",
      titleKey: "retention.title",
      descriptionKey: "retention.description",
      icon: RetentionIcon,
    },
    {
      href: "/admin/health",
      titleKey: "health.title",
      descriptionKey: "health.description",
      icon: HealthIcon,
    },
  ];

  return (
    <PageShell>
      {/* Header */}
      <PageHeader title={t("title")} description={t("subtitle")} />

      {/* Admin Cards Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {adminSections.map((section) => {
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

      {/* Quick Stats Section */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          {t("quickInfo.title")}
        </h2>
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <p className="text-gray-600">{t("quickInfo.description")}</p>
        </div>
      </div>
    </PageShell>
  );
}
