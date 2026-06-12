"use client";

/**
 * Finance Settings Hub content (E26-S6 migration of `app/finance/settings/page.tsx`).
 * Composition root (only `"use client"`) — self-embeds its own `QueryClientProvider`.
 *
 * Behaviour preserved AS-IS (A56, the E26-S1 hub net is the oracle):
 *   - Guard: spinner while `authLoading || !profileLoaded`. The profile read is `enabled` on
 *     `canReadFinance` only (A56 — it does NOT gate on authLoading), so a non-read user fires no
 *     GET → `profileLoaded` stays false → STUCK on the spinner (never reaches `return null`).
 *     `if (!canReadFinance) return null` is preserved (unreachable for a non-read user, AS-IS).
 *   - Static nav-card arrays (profile/general/simple-cash sections always visible).
 *   - DoubleEntry-derived enable/disable: setup cards render as links when DoubleEntry, locked
 *     otherwise; operational cards only when DoubleEntry.
 *   - Backfill panel (`isDoubleEntry && canWriteFinance`): POSTs `{ cutOffDate: date || undefined }`;
 *     surfaces the RAW res.error string on failure (the god-page throws err.message).
 *   - Danger-zone reset (`canWriteFinance`): typed-word confirm gate; DELETE /reset; on SUCCESS
 *     dispatches `finance-profile-changed` (via the hook) + shows the LOCALISED success; on failure
 *     shows the LOCALISED `resetFinanceError` and does NOT dispatch the event.
 */

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useFinanceProfile } from "../../hooks/use-finance-profile";
import {
  useBackfillDoubleEntry,
  useResetFinance,
} from "../../hooks/use-finance-settings-admin";
import type { BackfillResult } from "../../types/settings.types";

// --- Icons ---

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

const BuildingIcon = ({ className }: { className?: string }) => (
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
      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
    />
  </svg>
);

const AccountsIcon = ({ className }: { className?: string }) => (
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
      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
    />
  </svg>
);

const CategoriesIcon = ({ className }: { className?: string }) => (
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
      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"
    />
  </svg>
);

const TaxIcon = ({ className }: { className?: string }) => (
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
      d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"
    />
  </svg>
);

const TemplateIcon = ({ className }: { className?: string }) => (
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

const ActivityAreasIcon = ({ className }: { className?: string }) => (
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
      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
    />
  </svg>
);

const ExportsIcon = ({ className }: { className?: string }) => (
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
      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

const BankImportIcon = ({ className }: { className?: string }) => (
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
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
    />
  </svg>
);

const JournalIcon = ({ className }: { className?: string }) => (
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
      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
    />
  </svg>
);

const ReportsIcon = ({ className }: { className?: string }) => (
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
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
    />
  </svg>
);

const LockIcon = ({ className }: { className?: string }) => (
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
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
    />
  </svg>
);

interface SettingsCard {
  href: string;
  titleKey: string;
  descKey: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

const profileCards: SettingsCard[] = [
  {
    href: "/finance/settings/profile",
    titleKey: "settingsHub.profile",
    descKey: "settingsHub.profileDesc",
    icon: BuildingIcon,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
];

const generalCards: SettingsCard[] = [
  {
    href: "/finance/accounts",
    titleKey: "settingsHub.accounts",
    descKey: "settingsHub.accountsDesc",
    icon: AccountsIcon,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
  },
  {
    href: "/finance/categories",
    titleKey: "settingsHub.categories",
    descKey: "settingsHub.categoriesDesc",
    icon: CategoriesIcon,
    color: "text-violet-600",
    bgColor: "bg-violet-50",
  },
  {
    href: "/finance/settings/tax-codes",
    titleKey: "settingsHub.taxCodes",
    descKey: "settingsHub.taxCodesDesc",
    icon: TaxIcon,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  {
    href: "/finance/settings/invoice-templates",
    titleKey: "settingsHub.invoiceTemplates",
    descKey: "settingsHub.invoiceTemplatesDesc",
    icon: TemplateIcon,
    color: "text-pink-600",
    bgColor: "bg-pink-50",
  },
  {
    href: "/finance/settings/activity-areas",
    titleKey: "settingsHub.activityAreas",
    descKey: "settingsHub.activityAreasDesc",
    icon: ActivityAreasIcon,
    color: "text-teal-600",
    bgColor: "bg-teal-50",
  },
];

const simpleCashCards: SettingsCard[] = [
  {
    href: "/finance/exports",
    titleKey: "settingsHub.exports",
    descKey: "settingsHub.exportsDesc",
    icon: ExportsIcon,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
  },
  {
    href: "/finance/bank-import",
    titleKey: "settingsHub.bankImport",
    descKey: "settingsHub.bankImportDesc",
    icon: BankImportIcon,
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
  },
];

const accountingSetupCards: SettingsCard[] = [
  {
    href: "/finance/ledger-accounts",
    titleKey: "settingsHub.ledgerAccounts",
    descKey: "settingsHub.ledgerAccountsDesc",
    icon: AccountsIcon,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
  {
    href: "/finance/posting-mappings",
    titleKey: "settingsHub.postingMappings",
    descKey: "settingsHub.postingMappingsDesc",
    icon: CategoriesIcon,
    color: "text-rose-600",
    bgColor: "bg-rose-50",
  },
];

const accountingOperationalCards: SettingsCard[] = [
  {
    href: "/finance/journal-entries",
    titleKey: "settingsHub.journalEntries",
    descKey: "settingsHub.journalEntriesDesc",
    icon: JournalIcon,
    color: "text-sky-600",
    bgColor: "bg-sky-50",
  },
  {
    href: "/finance/accounting-reports",
    titleKey: "settingsHub.accountingReports",
    descKey: "settingsHub.accountingReportsDesc",
    icon: ReportsIcon,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
];

function SettingsHubBody() {
  const t = useTranslations("finance");
  const ts = useTranslations("finance.settings");
  const { canReadFinance, canWriteFinance, isLoading: authLoading } = useAuth();

  // Profile read drives the DoubleEntry-derived enable/disable. `enabled` on canReadFinance
  // ONLY (A56 — matches the god-page's `if (canReadFinance) fetchProfile()`); a non-read user
  // fires no GET so `profileLoaded` (isFetched) stays false → STUCK on the spinner.
  const profileQuery = useFinanceProfile(canReadFinance);
  const profileLoaded = profileQuery.isFetched;

  // A finance reset forces the mode back to SimpleCash locally (no refetch) — track that as a
  // flag and derive `isDoubleEntry` (avoids mirroring the query into state via an effect).
  const [resetDone, setResetDone] = useState(false);
  const isDoubleEntry =
    !resetDone && profileQuery.data?.profile?.accountingMode === "DoubleEntry";

  // Backfill panel state.
  const backfill = useBackfillDoubleEntry();
  const [backfillDate, setBackfillDate] = useState("");
  const [backfillResult, setBackfillResult] = useState<BackfillResult | null>(
    null
  );
  const [backfillError, setBackfillError] = useState<string | null>(null);

  const handleBackfill = () => {
    setBackfillResult(null);
    setBackfillError(null);
    backfill.mutate(
      { cutOffDate: backfillDate || undefined },
      {
        onSuccess: (data) => setBackfillResult(data),
        // A56: the god-page surfaces the RAW res.error string (err.message).
        onError: (err) =>
          setBackfillError(
            err instanceof Error ? err.message : t("settingsHub.backfillError")
          ),
      }
    );
  };

  // Danger-zone reset state.
  const resetFinance = useResetFinance();
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const confirmWord = t("settingsHub.resetFinanceConfirmWord");

  const handleFinanceReset = () => {
    if (resetConfirmText !== confirmWord) return;
    setResetError(null);
    setResetSuccess(null);
    resetFinance.mutate(undefined, {
      onSuccess: () => {
        // The hook dispatches finance-profile-changed; the hub shows the LOCALISED success.
        setResetSuccess(t("settingsHub.resetFinanceSuccess"));
        setShowResetModal(false);
        setResetConfirmText("");
        setResetDone(true);
      },
      // A56: the god-page catch maps to the LOCALISED key (NOT res.error).
      onError: () => setResetError(t("settingsHub.resetFinanceError")),
    });
  };

  if (authLoading || !profileLoaded) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex min-h-100 items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
          </div>
        </div>
      </main>
    );
  }

  if (!canReadFinance) {
    return null;
  }

  const renderCard = (card: SettingsCard) => {
    const IconComponent = card.icon;
    return (
      <Link
        key={card.href}
        href={card.href}
        className="group relative flex flex-col rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-orange-200 hover:shadow-md"
      >
        <div className="mb-4 flex items-center gap-4">
          <div className={`rounded-xl p-3 ${card.bgColor}`}>
            <IconComponent className={`h-6 w-6 ${card.color}`} />
          </div>
          <ChevronRightIcon className="ml-auto h-5 w-5 text-gray-300 transition-colors group-hover:text-orange-500" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 transition-colors group-hover:text-orange-600">
          {t(card.titleKey)}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-gray-500">
          {t(card.descKey)}
        </p>
      </Link>
    );
  };

  const renderDisabledCard = (card: SettingsCard) => {
    const IconComponent = card.icon;
    return (
      <div
        key={card.href}
        className="relative flex cursor-not-allowed flex-col rounded-xl border border-gray-200 bg-gray-50 p-6 opacity-60"
      >
        <div className="mb-4 flex items-center gap-4">
          <div className="rounded-xl bg-gray-100 p-3">
            <IconComponent className="h-6 w-6 text-gray-400" />
          </div>
          <LockIcon className="ml-auto h-5 w-5 text-gray-300" />
        </div>
        <h3 className="text-base font-semibold text-gray-500">
          {t(card.titleKey)}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-gray-400">
          {t(card.descKey)}
        </p>
        <span className="mt-2 inline-flex items-center gap-1 text-xs text-gray-400">
          <LockIcon className="h-3 w-3" />
          {t("settingsHub.requiresDoubleEntry")}
        </span>
      </div>
    );
  };

  const backfillRunning = backfill.isPending;
  const resetting = resetFinance.isPending;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
            {ts("title")}
          </h1>
          <p className="mt-1 text-gray-600">{t("settingsHub.subtitle")}</p>
        </div>

        {/* Section: Finanzprofil */}
        <div className="mb-8">
          <h2 className="mb-1 text-lg font-semibold text-gray-900">
            {t("settingsHub.profileSectionTitle")}
          </h2>
          <p className="mb-4 text-sm text-gray-500">
            {t("settingsHub.profileSectionDesc")}
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {profileCards.map(renderCard)}
          </div>
        </div>

        {/* Section: Allgemein */}
        <div className="mb-8">
          <h2 className="mb-1 text-lg font-semibold text-gray-900">
            {t("settingsHub.generalSectionTitle")}
          </h2>
          <p className="mb-4 text-sm text-gray-500">
            {t("settingsHub.generalSectionDesc")}
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {generalCards.map(renderCard)}
          </div>
        </div>

        {/* Section: Einfache Buchhaltung */}
        <div className="mb-8">
          <h2 className="mb-1 text-lg font-semibold text-gray-900">
            {t("settingsHub.simpleCashSectionTitle")}
          </h2>
          <p className="mb-4 text-sm text-gray-500">
            {t("settingsHub.simpleCashSectionDesc")}
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {simpleCashCards.map(renderCard)}
          </div>
        </div>

        {/* Section: Doppelte Buchhaltung */}
        <div className="mb-8">
          <h2 className="mb-1 text-lg font-semibold text-gray-900">
            {t("settingsHub.doubleEntrySection")}
          </h2>
          <p className="mb-4 text-sm text-gray-500">
            {isDoubleEntry
              ? t("settingsHub.doubleEntryActive")
              : t("settingsHub.doubleEntryInactive")}
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {accountingSetupCards.map((card) =>
              isDoubleEntry ? renderCard(card) : renderDisabledCard(card)
            )}
            {isDoubleEntry && accountingOperationalCards.map(renderCard)}
          </div>
        </div>

        {/* Backfill Double-Entry — only when active + write permission */}
        {isDoubleEntry && canWriteFinance && (
          <div className="mb-8 rounded-xl border-2 border-orange-200 bg-orange-50 p-6">
            <h2 className="mb-1 text-lg font-semibold text-orange-800">
              {t("settingsHub.backfillTitle")}
            </h2>
            <p className="mb-4 text-sm text-orange-700">
              {t("settingsHub.backfillDesc")}
            </p>

            <div className="rounded-lg border border-orange-200 bg-white p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700">
                    {t("settingsHub.backfillCutOffDate")}
                  </label>
                  <input
                    type="date"
                    value={backfillDate}
                    onChange={(e) => setBackfillDate(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {t("settingsHub.backfillCutOffHint")}
                  </p>
                </div>
                <button
                  onClick={handleBackfill}
                  disabled={backfillRunning}
                  className="rounded-lg bg-orange-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {backfillRunning ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                      {t("settingsHub.backfillRunning")}
                    </span>
                  ) : (
                    t("settingsHub.backfillButton")
                  )}
                </button>
              </div>

              {backfillError && (
                <div className="mt-4 rounded-lg bg-red-100 p-3 text-sm text-red-700">
                  {backfillError}
                </div>
              )}

              {backfillResult && (
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-lg bg-green-50 p-3 text-center">
                      <div className="text-2xl font-bold text-green-700">
                        {backfillResult.journalEntriesCreated}
                      </div>
                      <div className="text-xs text-green-600">
                        {t("settingsHub.backfillCreated")}
                      </div>
                    </div>
                    <div className="rounded-lg bg-blue-50 p-3 text-center">
                      <div className="text-2xl font-bold text-blue-700">
                        {backfillResult.transactionsProcessed}
                      </div>
                      <div className="text-xs text-blue-600">
                        {t("settingsHub.backfillTransactions")}
                      </div>
                    </div>
                    <div className="rounded-lg bg-indigo-50 p-3 text-center">
                      <div className="text-2xl font-bold text-indigo-700">
                        {backfillResult.paymentsProcessed}
                      </div>
                      <div className="text-xs text-indigo-600">
                        {t("settingsHub.backfillPayments")}
                      </div>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3 text-center">
                      <div className="text-2xl font-bold text-gray-700">
                        {backfillResult.skippedAlreadyPosted}
                      </div>
                      <div className="text-xs text-gray-600">
                        {t("settingsHub.backfillSkipped")}
                      </div>
                    </div>
                  </div>

                  {backfillResult.errorCount > 0 && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <h4 className="mb-2 text-sm font-semibold text-red-800">
                        {t("settingsHub.backfillErrors", {
                          count: backfillResult.errorCount,
                        })}
                      </h4>
                      <div className="max-h-48 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-red-200 text-left text-red-700">
                              <th className="pr-2 pb-1">
                                {t("settingsHub.backfillErrorType")}
                              </th>
                              <th className="pr-2 pb-1">ID</th>
                              <th className="pr-2 pb-1">
                                {t("settingsHub.backfillErrorDesc")}
                              </th>
                              <th className="pb-1">
                                {t("settingsHub.backfillErrorMessage")}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {backfillResult.errors.map((err, i) => (
                              <tr key={i} className="border-b border-red-100">
                                <td className="py-1 pr-2 text-red-700">
                                  {err.sourceType}
                                </td>
                                <td className="py-1 pr-2 font-mono text-red-600">
                                  {err.sourceId}
                                </td>
                                <td className="py-1 pr-2 text-red-600">
                                  {err.description}
                                </td>
                                <td className="py-1 text-red-600">
                                  {err.errorMessage}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {backfillResult.errorCount === 0 && (
                    <div className="rounded-lg bg-green-100 p-3 text-sm text-green-700">
                      {t("settingsHub.backfillSuccess")}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Danger Zone — Finance Reset */}
        {canWriteFinance && (
          <div className="mb-8 rounded-xl border-2 border-red-200 bg-red-50 p-6">
            <h2 className="mb-1 text-lg font-semibold text-red-800">
              {t("settingsHub.dangerZoneTitle")}
            </h2>
            <p className="mb-4 text-sm text-red-600">
              {t("settingsHub.dangerZoneDesc")}
            </p>

            {resetSuccess && (
              <div className="mb-4 rounded-lg bg-green-100 p-3 text-sm text-green-700">
                {resetSuccess}
              </div>
            )}
            {resetError && (
              <div className="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-700">
                {resetError}
              </div>
            )}

            <div className="flex items-start gap-4 rounded-lg border border-red-200 bg-white p-4">
              <div className="rounded-xl bg-red-100 p-3">
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
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-red-800">
                  {t("settingsHub.resetFinanceTitle")}
                </h3>
                <p className="mt-1 text-sm text-red-600">
                  {t("settingsHub.resetFinanceDesc")}
                </p>
                <button
                  onClick={() => {
                    setShowResetModal(true);
                    setResetConfirmText("");
                    setResetError(null);
                    setResetSuccess(null);
                  }}
                  className="mt-3 rounded-lg border border-red-300 bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
                >
                  {t("settingsHub.resetFinanceButton")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-red-800">
              {t("settingsHub.resetFinanceConfirmTitle")}
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              {t("settingsHub.resetFinanceConfirmText")}
            </p>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">
                {t("settingsHub.resetFinanceConfirmInput")}
              </label>
              <input
                type="text"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none"
                placeholder={confirmWord}
                autoFocus
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowResetModal(false);
                  setResetConfirmText("");
                }}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {t("settingsHub.resetFinanceCancel")}
              </button>
              <button
                onClick={handleFinanceReset}
                disabled={resetConfirmText !== confirmWord || resetting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resetting ? "..." : t("settingsHub.resetFinanceConfirmButton")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export function SettingsHubContent() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsHubBody />
    </QueryClientProvider>
  );
}
