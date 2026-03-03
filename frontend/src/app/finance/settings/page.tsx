"use client";

/**
 * Finance Settings Hub Page
 * Central hub for all finance configuration and settings.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth, useApiClient } from "@/lib/auth";

// --- Icons ---

const ChevronRightIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const BuildingIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const AccountsIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);

const CategoriesIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
  </svg>
);

const TaxIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
  </svg>
);

const TemplateIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const ActivityAreasIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
);

const ExportsIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const BankImportIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const JournalIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const ReportsIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const LockIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

// --- Settings card data type ---
interface SettingsCard {
  href: string;
  titleKey: string;
  descKey: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

/** Finanzprofil section — always visible */
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

/** Allgemein (General) section — always visible */
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

/** Einfache Buchhaltung section — tools for simple cash-based accounting */
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

/** Accounting settings cards — always shown but disabled when not DoubleEntry */
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

/** Accounting operational cards — only visible when DoubleEntry is active */
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

export default function FinanceSettingsPage() {
  const t = useTranslations("finance");
  const ts = useTranslations("finance.settings");
  const { canReadFinance, canWriteFinance, isLoading: authLoading } = useAuth();
  const api = useApiClient();
  const apiRef = useRef(api);
  apiRef.current = api;

  const [isDoubleEntry, setIsDoubleEntry] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await apiRef.current.get("/api/v1/finance/profile");
      if (!res.error && res.data) {
        const profile = res.data as { accountingMode?: string };
        setIsDoubleEntry(profile.accountingMode === "DoubleEntry");
      }
    } catch {
      // ignore — default to SimpleCash
    } finally {
      setProfileLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (canReadFinance) fetchProfile();
  }, [canReadFinance, fetchProfile]);

  const confirmWord = t("settingsHub.resetFinanceConfirmWord");

  const handleFinanceReset = async () => {
    if (resetConfirmText !== confirmWord) return;
    setResetting(true);
    setResetError(null);
    setResetSuccess(null);
    try {
      const res = await apiRef.current.delete("/api/v1/finance/reset");
      if (res.error) throw new Error(res.error);
      setResetSuccess(t("settingsHub.resetFinanceSuccess"));
      setShowResetModal(false);
      setResetConfirmText("");
      setIsDoubleEntry(false);
      window.dispatchEvent(new CustomEvent("finance-profile-changed"));
    } catch {
      setResetError(t("settingsHub.resetFinanceError"));
    } finally {
      setResetting(false);
    }
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

  /** Render a clickable settings card */
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

  /** Render a disabled / greyed-out settings card */
  const renderDisabledCard = (card: SettingsCard) => {
    const IconComponent = card.icon;
    return (
      <div
        key={card.href}
        className="relative flex flex-col rounded-xl border border-gray-200 bg-gray-50 p-6 opacity-60 cursor-not-allowed"
      >
        <div className="mb-4 flex items-center gap-4">
          <div className="rounded-xl p-3 bg-gray-100">
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
            {/* Setup cards: always shown, disabled when not DoubleEntry */}
            {accountingSetupCards.map((card) =>
              isDoubleEntry ? renderCard(card) : renderDisabledCard(card)
            )}
            {/* Operational cards: only shown when DoubleEntry */}
            {isDoubleEntry && accountingOperationalCards.map(renderCard)}
          </div>
        </div>

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
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
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
