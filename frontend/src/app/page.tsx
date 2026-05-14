"use client";

/**
 * Dashboard / Home Page
 * REQ-001: Shows different content based on authentication status
 * REQ-007: Includes onboarding banner for incomplete profiles
 * REQ-050: Dashboard KPIs for Vorstand/Admin
 */
import Link from "next/link";
import { useAuth, useApiClient } from "@/lib/auth";
import { useTranslations } from "next-intl";
import { OnboardingBanner } from "@/components/OnboardingBanner";
import { useState, useEffect, useCallback, useRef } from "react";
import { formatCHF } from "@/lib/utils";
import { useAppSettings } from "@/components/providers/AppSettingsProvider";

export default function HomePage() {
  const {
    isAuthenticated,
    isLoading,
    user,
    roles,
    isAdmin,
    isVorstand,
    isMember,
    canReadFinance,
  } = useAuth();
  const t = useTranslations();
  const tDash = useTranslations("dashboard");
  const { settings } = useAppSettings();
  const api = useApiClient();
  const apiRef = useRef(api);
  apiRef.current = api;

  const canViewKpis = isVorstand || isAdmin;

  const [kpiData, setKpiData] = useState<DashboardOverview | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiError, setKpiError] = useState<string | null>(null);

  const fetchKpis = useCallback(async () => {
    setKpiLoading(true);
    setKpiError(null);
    try {
      const res = await apiRef.current.get<DashboardOverview>(
        "/api/v1/reports/dashboard"
      );
      if (res.error) {
        setKpiError(res.error);
      } else if (res.data) {
        setKpiData(res.data);
      }
    } catch {
      setKpiError(t("common.error"));
    } finally {
      setKpiLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (isAuthenticated && canViewKpis) {
      fetchKpis();
    }
  }, [isAuthenticated, canViewKpis, fetchKpis]);

  if (isLoading) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center p-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
          <p className="mt-4 text-gray-600">{t("common.loading")}</p>
        </div>
      </main>
    );
  }

  // Unauthenticated view
  if (!isAuthenticated) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center bg-linear-to-br from-orange-50 to-amber-100 p-8">
        <div className="max-w-2xl text-center">
          <div
            className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full"
            style={{ backgroundColor: settings.logoBackgroundColor }}
          >
            <span
              className="text-4xl font-bold"
              style={{ color: settings.logoTextColor }}
            >
              {settings.logoText}
            </span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            {settings.applicationName}
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            {t("home.welcomeGuest", {
              organizationName: settings.applicationName,
            })}
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/public/events"
              className="rounded-lg border-2 border-orange-600 px-6 py-3 text-sm font-semibold text-orange-600 transition-colors hover:bg-orange-50"
            >
              {t("publicNav.events")}
            </Link>
            <Link
              href="/public/blog"
              className="rounded-lg border-2 border-orange-600 px-6 py-3 text-sm font-semibold text-orange-600 transition-colors hover:bg-orange-50"
            >
              {t("publicNav.blog")}
            </Link>
            <Link
              href="/public/contact"
              className="rounded-lg border-2 border-orange-600 px-6 py-3 text-sm font-semibold text-orange-600 transition-colors hover:bg-orange-50"
            >
              {t("publicNav.contact")}
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-orange-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700"
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
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* REQ-007: Onboarding Banner for incomplete profiles */}
        <OnboardingBanner />

        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
            {t("home.welcome", {
              name:
                user?.name ||
                t("home.welcomeMember")
                  .replace("Willkommen, ", "")
                  .replace("Welcome, ", "")
                  .replace("!", ""),
            })}
          </h1>
          <p className="mt-1 text-gray-600">
            {t("home.dashboardDescription", {
              organizationName: settings.applicationName,
            })}
          </p>
        </div>

        {/* Role Info Card */}
        <div className="mb-8 rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            {t("home.yourPermissions")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
                {t("roles.admin")}
              </span>
            )}
            {isVorstand && (
              <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                {t("roles.board")}
              </span>
            )}
            {isMember && (
              <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                {t("roles.member")}
              </span>
            )}
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Events — REQ-087 (E10-S4): hidden when the events module is disabled */}
          {settings.modules.events !== false && (
            <Link
              href="/events"
              className="group rounded-xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-orange-100 p-3 transition-colors group-hover:bg-orange-200">
                  <svg
                    className="h-6 w-6 text-orange-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {t("nav.events")}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {t("home.upcomingEvents")}
                  </p>
                </div>
              </div>
            </Link>
          )}

          {/* Documents — REQ-087 (E10-S4): hidden when the documents module is disabled */}
          {settings.modules.documents !== false && (
            <Link
              href="/documents"
              className="group rounded-xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-purple-100 p-3 transition-colors group-hover:bg-purple-200">
                  <svg
                    className="h-6 w-6 text-purple-600"
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
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {t("nav.documents")}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {t("home.accessDocuments")}
                  </p>
                </div>
              </div>
            </Link>
          )}

          {/* Members - Vorstand/Admin only — REQ-087 (E10-S4): + members module */}
          {(isVorstand || isAdmin) && settings.modules.members !== false && (
            <Link
              href="/members"
              className="group rounded-xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-blue-100 p-3 transition-colors group-hover:bg-blue-200">
                  <svg
                    className="h-6 w-6 text-blue-600"
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
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {t("nav.members")}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {t("home.memberManagement")}
                  </p>
                </div>
              </div>
            </Link>
          )}

          {/* Communication - Vorstand/Admin only — REQ-087 (E10-S4): + communication module */}
          {(isVorstand || isAdmin) &&
            settings.modules.communication !== false && (
              <Link
                href="/communication"
                className="group rounded-xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-green-100 p-3 transition-colors group-hover:bg-green-200">
                    <svg
                      className="h-6 w-6 text-green-600"
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
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {t("nav.communication")}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {t("home.sendEmails")}
                    </p>
                  </div>
                </div>
              </Link>
            )}

          {/* Finance - Vorstand/Admin only — REQ-087 (E10-S4): + finance module */}
          {(isVorstand || isAdmin) && settings.modules.finance !== false && (
            <Link
              href="/finance"
              className="group rounded-xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-yellow-100 p-3 transition-colors group-hover:bg-yellow-200">
                  <svg
                    className="h-6 w-6 text-yellow-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {t("nav.finance")}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {t("home.accountingInvoices")}
                  </p>
                </div>
              </div>
            </Link>
          )}

          {/* Partner (Sponsors & Suppliers) - Vorstand/Admin only — REQ-087 (E10-S4): + partners module */}
          {(isVorstand || isAdmin) && settings.modules.partners !== false && (
            <Link
              href="/sponsors"
              className="group rounded-xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-amber-100 p-3 transition-colors group-hover:bg-amber-200">
                  <svg
                    className="h-6 w-6 text-amber-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {t("nav.partner")}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {t("home.managePartners")}
                  </p>
                </div>
              </div>
            </Link>
          )}

          {/* Admin - Admin only */}
          {isAdmin && (
            <Link
              href="/admin"
              className="group rounded-xl border-2 border-red-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-red-100 p-3 transition-colors group-hover:bg-red-200">
                  <svg
                    className="h-6 w-6 text-red-600"
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
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {t("nav.admin")}
                  </h3>
                  <p className="text-sm text-gray-500">{t("nav.admin")}</p>
                </div>
              </div>
            </Link>
          )}
        </div>

        {/* REQ-050: Dashboard KPIs for Vorstand/Admin */}
        {canViewKpis && (
          <div className="mt-8 space-y-8">
            {kpiLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-orange-600"></div>
              </div>
            )}

            {kpiError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {kpiError}
              </div>
            )}

            {kpiData && (
              <>
                {/* Member KPIs — REQ-087 (E10-S4): gated by the members module */}
                {settings.modules.members !== false && (
                  <section>
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-gray-900">
                        {tDash("members.title")}
                      </h2>
                      <Link
                        href="/members"
                        className="text-sm font-medium text-orange-600 hover:text-orange-700"
                      >
                        {tDash("members.viewAll")} &rarr;
                      </Link>
                    </div>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                      <KpiCard
                        label={tDash("members.total")}
                        value={kpiData.members.totalMembers}
                      />
                      <KpiCard
                        label={tDash("members.active")}
                        value={kpiData.members.activeMembers}
                        color="green"
                      />
                      <KpiCard
                        label={tDash("members.pending")}
                        value={kpiData.members.pendingMembers}
                        color="yellow"
                      />
                      <KpiCard
                        label={tDash("members.inactive")}
                        value={kpiData.members.inactiveMembers}
                        color="gray"
                      />
                      <KpiCard
                        label={tDash("members.suspended")}
                        value={kpiData.members.suspendedMembers}
                        color="red"
                      />
                      <KpiCard
                        label={tDash("members.newInPeriod")}
                        value={kpiData.members.newMembersInPeriod}
                        color="blue"
                      />
                    </div>

                    {kpiData.members.monthlyTrend.length > 0 && (
                      <div className="mt-4 overflow-hidden rounded-xl bg-white shadow-sm">
                        <div className="border-b border-gray-200 px-6 py-4">
                          <h3 className="text-sm font-semibold text-gray-900">
                            {tDash("members.trend")}
                          </h3>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead className="border-b border-gray-200 bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 font-medium text-gray-700">
                                  {tDash("members.month")}
                                </th>
                                <th className="px-4 py-3 text-right font-medium text-gray-700">
                                  {tDash("members.newMembers")}
                                </th>
                                <th className="px-4 py-3 text-right font-medium text-gray-700">
                                  {tDash("members.totalAtEnd")}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {kpiData.members.monthlyTrend.map((item) => (
                                <tr
                                  key={item.month}
                                  className="hover:bg-gray-50"
                                >
                                  <td className="px-4 py-3 text-gray-900">
                                    {item.month}
                                  </td>
                                  <td className="px-4 py-3 text-right text-gray-900 tabular-nums">
                                    {item.newMembers > 0
                                      ? `+${item.newMembers}`
                                      : item.newMembers}
                                  </td>
                                  <td className="px-4 py-3 text-right text-gray-500 tabular-nums">
                                    {item.totalAtEndOfMonth}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {/* Event KPIs — REQ-087 (E10-S4): gated by the events module */}
                {settings.modules.events !== false && (
                  <section>
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-gray-900">
                        {tDash("events.title")}
                      </h2>
                      <Link
                        href="/events"
                        className="text-sm font-medium text-orange-600 hover:text-orange-700"
                      >
                        {tDash("events.viewAll")} &rarr;
                      </Link>
                    </div>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                      <KpiCard
                        label={tDash("events.total")}
                        value={kpiData.events.totalEvents}
                      />
                      <KpiCard
                        label={tDash("events.upcoming")}
                        value={kpiData.events.upcomingEvents}
                        color="blue"
                      />
                      <KpiCard
                        label={tDash("events.completed")}
                        value={kpiData.events.completedEvents}
                        color="green"
                      />
                      <KpiCard
                        label={tDash("events.cancelled")}
                        value={kpiData.events.cancelledEvents}
                        color="red"
                      />
                      <KpiCard
                        label={tDash("events.registrations")}
                        value={kpiData.events.totalRegistrations}
                      />
                      <KpiCard
                        label={tDash("events.participants")}
                        value={kpiData.events.totalParticipantsConfirmed}
                        color="green"
                      />
                    </div>

                    {kpiData.events.byCategory.length > 0 && (
                      <div className="mt-4 overflow-hidden rounded-xl bg-white shadow-sm">
                        <div className="border-b border-gray-200 px-6 py-4">
                          <h3 className="text-sm font-semibold text-gray-900">
                            {tDash("events.byCategory")}
                          </h3>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead className="border-b border-gray-200 bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 font-medium text-gray-700">
                                  {tDash("events.category")}
                                </th>
                                <th className="px-4 py-3 text-right font-medium text-gray-700">
                                  {tDash("events.count")}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {kpiData.events.byCategory.map((cat) => (
                                <tr
                                  key={cat.category}
                                  className="hover:bg-gray-50"
                                >
                                  <td className="px-4 py-3 text-gray-900">
                                    {cat.category}
                                  </td>
                                  <td className="px-4 py-3 text-right text-gray-900 tabular-nums">
                                    {cat.count}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {/* Finance KPIs — REQ-087 (E10-S4): + finance module */}
                {canReadFinance && settings.modules.finance !== false && (
                  <section>
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-gray-900">
                        {tDash("finance.title")}
                      </h2>
                      <Link
                        href="/finance"
                        className="text-sm font-medium text-orange-600 hover:text-orange-700"
                      >
                        {tDash("finance.viewAll")} &rarr;
                      </Link>
                    </div>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-7">
                      <KpiCard
                        label={tDash("finance.income")}
                        value={formatCHF(kpiData.finance.totalIncome)}
                        color="green"
                      />
                      <KpiCard
                        label={tDash("finance.expense")}
                        value={formatCHF(kpiData.finance.totalExpense)}
                        color="red"
                      />
                      <KpiCard
                        label={tDash("finance.balance")}
                        value={formatCHF(kpiData.finance.balance)}
                        color={kpiData.finance.balance >= 0 ? "green" : "red"}
                      />
                      <KpiCard
                        label={tDash("finance.openInvoices")}
                        value={kpiData.finance.openInvoiceCount}
                        color="yellow"
                      />
                      <KpiCard
                        label={tDash("finance.overdueInvoices")}
                        value={kpiData.finance.overdueInvoiceCount}
                        color="red"
                      />
                      <KpiCard
                        label={tDash("finance.pendingPayments")}
                        value={kpiData.finance.pendingPaymentCount}
                        color="yellow"
                      />
                      <KpiCard
                        label={tDash("finance.pendingClaims")}
                        value={kpiData.finance.pendingExpenseClaimCount}
                        color="yellow"
                      />
                    </div>
                    {kpiData.finance.currentFiscalPeriod && (
                      <div className="mt-4 rounded-xl bg-white p-4 shadow-sm">
                        <p className="text-xs text-gray-500">
                          {tDash("finance.fiscalPeriod")}
                        </p>
                        <p className="text-sm font-medium text-gray-900">
                          {kpiData.finance.currentFiscalPeriod} (
                          {kpiData.finance.currentPeriodStatus})
                        </p>
                      </div>
                    )}
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

// --- Types for REQ-050 KPIs ---

interface MemberTrendItem {
  month: string;
  newMembers: number;
  totalAtEndOfMonth: number;
}

interface MemberKpis {
  totalMembers: number;
  activeMembers: number;
  pendingMembers: number;
  inactiveMembers: number;
  suspendedMembers: number;
  newMembersInPeriod: number;
  monthlyTrend: MemberTrendItem[];
}

interface EventCategoryBreakdown {
  category: string;
  count: number;
  totalRegistrations: number;
}

interface EventKpis {
  totalEvents: number;
  upcomingEvents: number;
  completedEvents: number;
  cancelledEvents: number;
  totalRegistrations: number;
  totalParticipantsConfirmed: number;
  totalEventRevenue: number;
  byCategory: EventCategoryBreakdown[];
}

interface FinanceKpis {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  outstandingInvoices: number;
  overdueInvoiceCount: number;
  overdueAmount: number;
  openInvoiceCount: number;
  pendingPayments: number;
  pendingPaymentCount: number;
  pendingExpenseClaims: number;
  pendingExpenseClaimCount: number;
  currentFiscalPeriod: string | null;
  currentPeriodStatus: string | null;
}

interface DashboardOverview {
  members: MemberKpis;
  events: EventKpis;
  finance: FinanceKpis;
}

// --- KPI Card Component ---

function KpiCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: "green" | "red" | "yellow" | "blue" | "gray";
}) {
  const colorClasses: Record<string, string> = {
    green: "text-green-700",
    red: "text-red-600",
    yellow: "text-yellow-700",
    blue: "text-blue-700",
    gray: "text-gray-500",
  };

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="mb-1 text-xs text-gray-500">{label}</p>
      <p
        className={`text-lg font-semibold tabular-nums ${color ? colorClasses[color] : "text-gray-900"}`}
      >
        {value}
      </p>
    </div>
  );
}
