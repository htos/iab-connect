"use client";

/**
 * Communication Dashboard Page
 * Central hub for email campaigns and templates management
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import Link from "next/link";

// Icons as components
const EmailCampaignIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
    />
  </svg>
);

const EmailTemplateIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

const ChevronRightIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

export default function CommunicationPage() {
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
      <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
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
  ];

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              {t("title")}
            </h1>
            <p className="text-gray-600 mt-1">{t("subtitle")}</p>
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
                className="group bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-orange-100 rounded-xl">
                    <IconComponent className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-orange-600 transition-colors">
                      {t(section.titleKey)}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      {t(section.descriptionKey)}
                    </p>
                  </div>
                  <ChevronRightIcon className="h-5 w-5 text-gray-400 group-hover:text-orange-600 transition-colors flex-shrink-0 mt-1" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t("quickActions.title")}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link
              href="/communication/email-campaigns/new"
              className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="font-medium text-gray-900">{t("quickActions.newCampaign")}</span>
            </Link>
            <Link
              href="/communication/email-templates/new"
              className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="font-medium text-gray-900">{t("quickActions.newTemplate")}</span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
