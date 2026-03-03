"use client";

/**
 * Dashboard / Home Page for IAB Connect
 * REQ-001: Shows different content based on authentication status
 * REQ-007: Includes onboarding banner for incomplete profiles
 */
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useTranslations } from "next-intl";
import { OnboardingBanner } from "@/components/OnboardingBanner";

export default function HomePage() {
  const { isAuthenticated, isLoading, user, roles, isAdmin, isVorstand, isMember } = useAuth();
  const t = useTranslations();

  if (isLoading) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t("common.loading")}</p>
        </div>
      </main>
    );
  }

  // Unauthenticated view
  if (!isAuthenticated) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center p-8 bg-linear-to-br from-orange-50 to-amber-100">
        <div className="text-center max-w-2xl">
          <div className="mx-auto h-24 w-24 bg-orange-600 rounded-full flex items-center justify-center mb-6">
            <span className="text-4xl text-white font-bold">IAB</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            IAB Connect
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            {t("home.welcomeGuest")}
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/public/events"
              className="rounded-lg border-2 border-orange-600 px-6 py-3 text-sm font-semibold text-orange-600 hover:bg-orange-50 transition-colors"
            >
              {t("publicNav.events")}
            </Link>
            <Link
              href="/public/blog"
              className="rounded-lg border-2 border-orange-600 px-6 py-3 text-sm font-semibold text-orange-600 hover:bg-orange-50 transition-colors"
            >
              {t("publicNav.blog")}
            </Link>
            <Link
              href="/public/contact"
              className="rounded-lg border-2 border-orange-600 px-6 py-3 text-sm font-semibold text-orange-600 hover:bg-orange-50 transition-colors"
            >
              {t("publicNav.contact")}
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-orange-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 transition-colors"
            >
              {t("auth.signIn")}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Authenticated Dashboard
  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* REQ-007: Onboarding Banner for incomplete profiles */}
        <OnboardingBanner />

        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {t("home.welcome", { name: user?.name || t("home.welcomeMember").replace("Willkommen, ", "").replace("Welcome, ", "").replace("!", "") })}
          </h1>
          <p className="text-gray-600 mt-1">
            {t("home.dashboardDescription")}
          </p>
        </div>

        {/* Role Info Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t("home.yourPermissions")}</h2>
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                {t("roles.admin")}
              </span>
            )}
            {isVorstand && (
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                {t("roles.board")}
              </span>
            )}
            {isMember && (
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                {t("roles.member")}
              </span>
            )}
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Events - visible to all */}
          <Link
            href="/events"
            className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-lg group-hover:bg-orange-200 transition-colors">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{t("nav.events")}</h3>
                <p className="text-sm text-gray-500">{t("home.upcomingEvents")}</p>
              </div>
            </div>
          </Link>

          {/* Documents - visible to all */}
          <Link
            href="/documents"
            className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{t("nav.documents")}</h3>
                <p className="text-sm text-gray-500">{t("home.accessDocuments")}</p>
              </div>
            </div>
          </Link>

          {/* Members - Vorstand/Admin only */}
          {(isVorstand || isAdmin) && (
            <Link
              href="/members"
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div>
                <h3 className="font-semibold text-gray-900">{t("nav.members")}</h3>
                <p className="text-sm text-gray-500">{t("home.memberManagement")}</p>
                </div>
              </div>
            </Link>
          )}

          {/* Communication - Vorstand/Admin only */}
          {(isVorstand || isAdmin) && (
            <Link
              href="/communication"
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                <h3 className="font-semibold text-gray-900">{t("nav.communication")}</h3>
                <p className="text-sm text-gray-500">{t("home.sendEmails")}</p>
                </div>
              </div>
            </Link>
          )}

          {/* Finance - Vorstand/Admin only */}
          {(isVorstand || isAdmin) && (
            <Link
              href="/finance"
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-100 rounded-lg group-hover:bg-yellow-200 transition-colors">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                <h3 className="font-semibold text-gray-900">{t("nav.finance")}</h3>
                <p className="text-sm text-gray-500">{t("home.accountingInvoices")}</p>
                </div>
              </div>
            </Link>
          )}

          {/* Partner (Sponsors & Suppliers) - Vorstand/Admin only */}
          {(isVorstand || isAdmin) && (
            <Link
              href="/sponsors"
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-100 rounded-lg group-hover:bg-amber-200 transition-colors">
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{t("nav.partner")}</h3>
                  <p className="text-sm text-gray-500">{t("home.managePartners")}</p>
                </div>
              </div>
            </Link>
          )}

          {/* Admin - Admin only */}
          {isAdmin && (
            <Link
              href="/admin"
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow group border-2 border-red-100"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-100 rounded-lg group-hover:bg-red-200 transition-colors">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{t("nav.admin")}</h3>
                  <p className="text-sm text-gray-500">{t("nav.admin")}</p>
                </div>
              </div>
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
