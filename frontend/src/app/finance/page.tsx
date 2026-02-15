"use client";

/**
 * Finance Dashboard Page
 * REQ-038: Finance Module Dashboard
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth, useApiClient } from "@/lib/auth";

// --- Types ---

interface TransactionSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

interface OpenInvoice {
  id: string;
  total: number;
}

interface OpenInvoicesSummary {
  count: number;
  totalAmount: number;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "Income" | "Expense";
  categoryName: string;
  accountName: string;
}

// --- Icons ---

const HomeIcon = ({ className }: { className?: string }) => (
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
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z"
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

const TransactionsIcon = ({ className }: { className?: string }) => (
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
      d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
    />
  </svg>
);

const InvoicesIcon = ({ className }: { className?: string }) => (
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

const PaymentsIcon = ({ className }: { className?: string }) => (
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
      d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
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

// --- Helpers ---

const formatCHF = (amount: number) =>
  new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(
    amount
  );

// --- Component ---

export default function FinanceDashboardPage() {
  const t = useTranslations("finance");
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, canReadFinance } = useAuth();
  const api = useApiClient();

  // Stable refs for callbacks to avoid infinite loops
  const apiRef = useRef(api);
  apiRef.current = api;
  const tRef = useRef(t);
  tRef.current = t;

  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [openInvoices, setOpenInvoices] = useState<OpenInvoicesSummary | null>(
    null
  );
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect if not authorized
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !canReadFinance)) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, canReadFinance, router]);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [summaryRes, invoicesRes, transactionsRes] = await Promise.all([
        apiRef.current.get<TransactionSummary>(
          "/api/v1/finance/transactions/summary"
        ),
        apiRef.current.get<OpenInvoice[]>("/api/v1/finance/invoices/open"),
        apiRef.current.get<Transaction[]>("/api/v1/finance/transactions"),
      ]);

      if (summaryRes.error || invoicesRes.error || transactionsRes.error) {
        setError(
          summaryRes.error || invoicesRes.error || transactionsRes.error
        );
      }

      if (summaryRes.data) setSummary(summaryRes.data as TransactionSummary);
      if (invoicesRes.data) {
        const invoiceList = invoicesRes.data as OpenInvoice[];
        setOpenInvoices({
          count: invoiceList.length,
          totalAmount: invoiceList.reduce((sum, inv) => sum + inv.total, 0),
        });
      }
      if (transactionsRes.data)
        setRecentTransactions(
          (transactionsRes.data as Transaction[]).slice(0, 10)
        );
    } catch {
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && canReadFinance) {
      fetchDashboardData();
    }
  }, [isAuthenticated, canReadFinance, fetchDashboardData]);

  // Loading state
  if (authLoading || loading) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated || !canReadFinance) {
    return null;
  }

  const quickLinks = [
    {
      href: "/finance/transactions",
      titleKey: "transactions" as const,
      icon: TransactionsIcon,
    },
    {
      href: "/finance/invoices",
      titleKey: "invoices" as const,
      icon: InvoicesIcon,
    },
    {
      href: "/finance/payments",
      titleKey: "payments" as const,
      icon: PaymentsIcon,
    },
    {
      href: "/finance/bank-import",
      titleKey: "bankImport" as const,
      icon: BankImportIcon,
    },
    {
      href: "/finance/accounts",
      titleKey: "accounts" as const,
      icon: AccountsIcon,
    },
    {
      href: "/finance/categories",
      titleKey: "categories" as const,
      icon: CategoriesIcon,
    },
  ];

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Breadcrumb */}
        <nav className="mb-4 flex items-center text-sm text-gray-500">
          <Link
            href="/"
            className="flex items-center gap-1 transition-colors hover:text-orange-600"
          >
            <HomeIcon className="h-4 w-4" />
            <span>Home</span>
          </Link>
          <ChevronRightIcon className="mx-2 h-4 w-4" />
          <span className="font-medium text-gray-900">{t("title")}</span>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
            {t("dashboard")}
          </h1>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        {/* KPI Cards Row */}
        <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {/* Total Income */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              {t("totalIncome")}
            </p>
            <p className="mt-2 text-2xl font-bold text-green-600">
              {summary ? formatCHF(summary.totalIncome) : "–"}
            </p>
          </div>

          {/* Total Expenses */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              {t("totalExpense")}
            </p>
            <p className="mt-2 text-2xl font-bold text-red-600">
              {summary ? formatCHF(summary.totalExpense) : "–"}
            </p>
          </div>

          {/* Balance */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">{t("balance")}</p>
            <p className="mt-2 text-2xl font-bold text-orange-600">
              {summary ? formatCHF(summary.balance) : "–"}
            </p>
          </div>
        </div>

        {/* Open Invoices Card */}
        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            {t("openInvoices")}
          </h2>
          <p className="mb-3 text-sm text-gray-500">
            {t("openItemsDescription")}
          </p>
          {openInvoices ? (
            <div className="flex items-center gap-8">
              <div>
                <p className="text-3xl font-bold text-orange-600">
                  {openInvoices.count}
                </p>
                <p className="text-sm text-gray-500">{t("openItems")}</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">
                  {formatCHF(openInvoices.totalAmount)}
                </p>
                <p className="text-sm text-gray-500">{t("total")}</p>
              </div>
            </div>
          ) : (
            <p className="text-gray-400">{t("noData")}</p>
          )}
        </div>

        {/* Recent Transactions Table */}
        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {t("recentTransactions")}
            </h2>
            <Link
              href="/finance/transactions"
              className="text-sm font-medium text-orange-600 hover:text-orange-700"
            >
              {t("transactions")} →
            </Link>
          </div>

          {recentTransactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="pr-4 pb-3 font-medium">
                      {t("transactionDate")}
                    </th>
                    <th className="pr-4 pb-3 font-medium">
                      {t("transactionDescription")}
                    </th>
                    <th className="pr-4 pb-3 text-right font-medium">
                      {t("transactionAmount")}
                    </th>
                    <th className="pr-4 pb-3 font-medium">
                      {t("transactionCategory")}
                    </th>
                    <th className="pb-3 font-medium">
                      {t("transactionAccount")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="border-b border-gray-100 last:border-0"
                    >
                      <td className="py-3 pr-4 text-gray-600">
                        {new Date(tx.date).toLocaleDateString("de-CH")}
                      </td>
                      <td className="py-3 pr-4 text-gray-900">
                        {tx.description}
                      </td>
                      <td
                        className={`py-3 pr-4 text-right font-medium ${
                          tx.type === "Income"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {tx.type === "Income" ? "+" : "−"}
                        {formatCHF(Math.abs(tx.amount))}
                      </td>
                      <td className="py-3 pr-4 text-gray-600">
                        {tx.categoryName}
                      </td>
                      <td className="py-3 text-gray-600">{tx.accountName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-400">{t("noData")}</p>
          )}
        </div>

        {/* Quick Links */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            {t("title")}
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {quickLinks.map((link) => {
              const IconComponent = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group rounded-xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start gap-4">
                    <div className="rounded-xl bg-orange-100 p-3">
                      <IconComponent className="h-6 w-6 text-orange-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 transition-colors group-hover:text-orange-600">
                        {t(link.titleKey)}
                      </h3>
                    </div>
                    <ChevronRightIcon className="mt-1 h-5 w-5 flex-shrink-0 text-gray-400 transition-colors group-hover:text-orange-600" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
