"use client";

import { formatCHF } from "@/lib/utils";

/**
 * Finance Dashboard Page
 * REQ-038: Finance overview with KPI cards, open items and recent transactions
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

interface FinanceDashboard {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  invoicesTotalOutstanding: number;
  invoicesOverdueCount: number;
  invoicesOverdueAmount: number;
  invoicesOpenCount: number;
  paymentsTotalPending: number;
  paymentsTotalPaid: number;
  paymentsPendingCount: number;
  expenseClaimsTotalPending: number;
  expenseClaimsTotalReimbursed: number;
  expenseClaimsPendingCount: number;
  currentFiscalPeriod: string | null;
  currentPeriodStatus: string | null;
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

// --- Helpers ---


// --- Component ---

export default function FinanceDashboardPage() {
  const t = useTranslations("finance");
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, canReadFinance } = useAuth();
  const api = useApiClient();

  const apiRef = useRef(api);
  apiRef.current = api;
  const tRef = useRef(t);
  tRef.current = t;

  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [dashboard, setDashboard] = useState<FinanceDashboard | null>(null);
  const [openInvoices, setOpenInvoices] = useState<OpenInvoicesSummary | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !canReadFinance)) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, canReadFinance, router]);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [summaryRes, dashboardRes, invoicesRes, transactionsRes] = await Promise.all([
        apiRef.current.get<TransactionSummary>("/api/v1/finance/transactions/summary"),
        apiRef.current.get<FinanceDashboard>("/api/v1/finance/dashboard"),
        apiRef.current.get<OpenInvoice[]>("/api/v1/finance/invoices/open"),
        apiRef.current.get<Transaction[]>("/api/v1/finance/transactions"),
      ]);

      if (summaryRes.error || dashboardRes.error || invoicesRes.error || transactionsRes.error) {
        setError(summaryRes.error || dashboardRes.error || invoicesRes.error || transactionsRes.error);
      }

      if (summaryRes.data) setSummary(summaryRes.data as TransactionSummary);
      if (dashboardRes.data) setDashboard(dashboardRes.data as FinanceDashboard);
      if (invoicesRes.data) {
        const invoiceList = invoicesRes.data as OpenInvoice[];
        setOpenInvoices({
          count: invoiceList.length,
          totalAmount: invoiceList.reduce((sum, inv) => sum + inv.total, 0),
        });
      }
      if (transactionsRes.data) {
        const body = transactionsRes.data as unknown as { items: Transaction[] };
        setRecentTransactions((body.items ?? []).slice(0, 10));
      }
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

  if (authLoading || loading) {
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

  if (!isAuthenticated || !canReadFinance) {
    return null;
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t("dashboard")}
            </h1>
            <p className="text-gray-600 mt-1">{t("title")}</p>
          </div>
          {dashboard?.currentFiscalPeriod && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>{t("currentFiscalPeriod")}:</span>
              <span className="font-medium text-gray-900">
                {dashboard.currentFiscalPeriod}
              </span>
              {dashboard.currentPeriodStatus && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                  {dashboard.currentPeriodStatus}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">{t("totalIncome")}</p>
            <p className="text-lg font-semibold text-gray-900 tabular-nums">
              {summary ? formatCHF(summary.totalIncome) : "—"}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">{t("totalExpense")}</p>
            <p className="text-lg font-semibold text-gray-900 tabular-nums">
              {summary ? formatCHF(summary.totalExpense) : "—"}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">{t("balance")}</p>
            <p className={`text-lg font-semibold tabular-nums ${
              (summary?.balance ?? 0) >= 0 ? "text-gray-900" : "text-red-600"
            }`}>
              {summary ? formatCHF(summary.balance) : "—"}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">{t("openInvoices")}</p>
            <p className="text-lg font-semibold text-gray-900 tabular-nums">
              {openInvoices ? formatCHF(openInvoices.totalAmount) : "—"}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">{t("overdueInvoices")}</p>
            <p className={`text-lg font-semibold tabular-nums ${
              (dashboard?.invoicesOverdueCount ?? 0) > 0 ? "text-red-600" : "text-gray-900"
            }`}>
              {dashboard ? dashboard.invoicesOverdueCount : "—"}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">{t("pendingPayments")}</p>
            <p className="text-lg font-semibold text-gray-900 tabular-nums">
              {dashboard ? dashboard.paymentsPendingCount : "—"}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">{t("pendingExpenseClaims")}</p>
            <p className="text-lg font-semibold text-gray-900 tabular-nums">
              {dashboard ? dashboard.expenseClaimsPendingCount : "—"}
            </p>
          </div>
        </div>

        {/* Open Items Card */}
        {dashboard && (
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {t("openItemsSection")}
              </h2>
              <Link
                href="/finance/invoices"
                className="text-sm text-orange-600 hover:text-orange-700 font-medium transition-colors"
              >
                {t("invoices")} &rarr;
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-700">{t("description")}</th>
                    <th className="px-4 py-3 font-medium text-gray-700 text-center">{t("count")}</th>
                    <th className="px-4 py-3 font-medium text-gray-700 text-right">{t("amount")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-4 py-3 text-gray-900">{t("openInvoices")}</td>
                    <td className="px-4 py-3 text-gray-500 text-center">{dashboard.invoicesOpenCount}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-900">
                      {formatCHF(dashboard.invoicesTotalOutstanding)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-gray-900">{t("overdueInvoices")}</td>
                    <td className="px-4 py-3 text-gray-500 text-center">{dashboard.invoicesOverdueCount}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-red-600">
                      {formatCHF(dashboard.invoicesOverdueAmount)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-gray-900">{t("pendingPayments")}</td>
                    <td className="px-4 py-3 text-gray-500 text-center">{dashboard.paymentsPendingCount}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-900">
                      {formatCHF(dashboard.paymentsTotalPending)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-gray-900">{t("pendingExpenseClaims")}</td>
                    <td className="px-4 py-3 text-gray-500 text-center">{dashboard.expenseClaimsPendingCount}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-900">
                      {formatCHF(dashboard.expenseClaimsTotalPending)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Transactions Card */}
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              {t("recentTransactions")}
            </h2>
            <Link
              href="/finance/transactions"
              className="text-sm text-orange-600 hover:text-orange-700 font-medium transition-colors"
            >
              {t("transactions")} &rarr;
            </Link>
          </div>
          {recentTransactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-700">{t("transactionDate")}</th>
                    <th className="px-4 py-3 font-medium text-gray-700">{t("transactionDescription")}</th>
                    <th className="px-4 py-3 font-medium text-gray-700">{t("transactionCategory")}</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-700">{t("transactionAmount")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentTransactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="px-4 py-3 text-gray-500 tabular-nums whitespace-nowrap">
                        {new Date(tx.date).toLocaleDateString("de-CH")}
                      </td>
                      <td className="px-4 py-3 text-gray-900">
                        {tx.description}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {tx.categoryName}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums whitespace-nowrap text-gray-900">
                        {tx.type === "Expense"
                          ? formatCHF(-Math.abs(tx.amount))
                          : formatCHF(Math.abs(tx.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-gray-500">{t("noData")}</div>
          )}
        </div>
      </div>
    </main>
  );
}
