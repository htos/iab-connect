"use client";

/**
 * Finance Settings Hub Page
 * Central hub for all finance configuration and settings.
 */

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";

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

// --- Settings card data type ---
interface SettingsCard {
  href: string;
  titleKey: string;
  descKey: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

const settingsCards: SettingsCard[] = [
  {
    href: "/finance/settings/profile",
    titleKey: "settingsHub.profile",
    descKey: "settingsHub.profileDesc",
    icon: BuildingIcon,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
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

export default function FinanceSettingsPage() {
  const t = useTranslations("finance");
  const ts = useTranslations("finance.settings");
  const { canReadFinance, isLoading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
          </div>
        </div>
      </main>
    );
  }

  if (!canReadFinance) {
    return null;
  }

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

        {/* Settings Cards Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {settingsCards.map((card) => {
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
          })}
        </div>
      </div>
    </main>
  );
}
