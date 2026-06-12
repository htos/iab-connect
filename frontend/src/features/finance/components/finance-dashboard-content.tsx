"use client";

/**
 * Finance Dashboard content (E26-S2 feature-slice migration of `app/finance/page.tsx`).
 * REQ-038: KPI cards, open items and recent transactions (read-only).
 *
 * Composition root — the only `"use client"` for the dashboard surface. Self-embeds its
 * own `QueryClientProvider` (admin-settings precedent) so the slice's TanStack hooks work
 * when the page is rendered in isolation (the E26-S1 oracle renders `<Page />` directly).
 * The canonical read guard (`isAuthenticated`/`authLoading` + `router.push("/")` + spinner
 * → `return null`) and every i18n key / URL are preserved verbatim.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { formatCHF } from "@/lib/utils";
import { useFinanceDashboard } from "../hooks/use-finance-dashboard";

function FinanceDashboardBody() {
  const t = useTranslations("finance");
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, canReadFinance } = useAuth();
  const enabled = isAuthenticated && canReadFinance;

  const query = useFinanceDashboard(enabled);
  const summary = query.data?.summary ?? null;
  const dashboard = query.data?.dashboard ?? null;
  const openInvoices = query.data?.openInvoices ?? null;
  const recentTransactions = query.data?.recentTransactions ?? [];
  const error = query.isError ? (query.error as Error).message : null;

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !canReadFinance)) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, canReadFinance, router]);

  if (authLoading || (enabled && query.isLoading)) {
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
            <p className="mt-1 text-gray-600">{t("title")}</p>
          </div>
          {dashboard?.currentFiscalPeriod && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>{t("currentFiscalPeriod")}:</span>
              <span className="font-medium text-gray-900">
                {dashboard.currentFiscalPeriod}
              </span>
              {dashboard.currentPeriodStatus && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
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
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="mb-1 text-xs text-gray-500">{t("totalIncome")}</p>
            <p className="text-lg font-semibold text-gray-900 tabular-nums">
              {summary ? formatCHF(summary.totalIncome) : "—"}
            </p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="mb-1 text-xs text-gray-500">{t("totalExpense")}</p>
            <p className="text-lg font-semibold text-gray-900 tabular-nums">
              {summary ? formatCHF(summary.totalExpense) : "—"}
            </p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="mb-1 text-xs text-gray-500">{t("balance")}</p>
            <p
              className={`text-lg font-semibold tabular-nums ${
                (summary?.balance ?? 0) >= 0 ? "text-gray-900" : "text-red-600"
              }`}
            >
              {summary ? formatCHF(summary.balance) : "—"}
            </p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="mb-1 text-xs text-gray-500">{t("openInvoices")}</p>
            <p className="text-lg font-semibold text-gray-900 tabular-nums">
              {openInvoices ? formatCHF(openInvoices.totalAmount) : "—"}
            </p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="mb-1 text-xs text-gray-500">{t("overdueInvoices")}</p>
            <p
              className={`text-lg font-semibold tabular-nums ${
                (dashboard?.invoicesOverdueCount ?? 0) > 0
                  ? "text-red-600"
                  : "text-gray-900"
              }`}
            >
              {dashboard ? dashboard.invoicesOverdueCount : "—"}
            </p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="mb-1 text-xs text-gray-500">{t("pendingPayments")}</p>
            <p className="text-lg font-semibold text-gray-900 tabular-nums">
              {dashboard ? dashboard.paymentsPendingCount : "—"}
            </p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="mb-1 text-xs text-gray-500">
              {t("pendingExpenseClaims")}
            </p>
            <p className="text-lg font-semibold text-gray-900 tabular-nums">
              {dashboard ? dashboard.expenseClaimsPendingCount : "—"}
            </p>
          </div>
        </div>

        {/* Open Items Card */}
        {dashboard && (
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {t("openItemsSection")}
              </h2>
              <Link
                href="/finance/invoices"
                className="text-sm font-medium text-orange-600 transition-colors hover:text-orange-700"
              >
                {t("invoices")} &rarr;
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-700">
                      {t("description")}
                    </th>
                    <th className="px-4 py-3 text-center font-medium text-gray-700">
                      {t("count")}
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-gray-700">
                      {t("amount")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-4 py-3 text-gray-900">
                      {t("openInvoices")}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500">
                      {dashboard.invoicesOpenCount}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 tabular-nums">
                      {formatCHF(dashboard.invoicesTotalOutstanding)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-gray-900">
                      {t("overdueInvoices")}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500">
                      {dashboard.invoicesOverdueCount}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-red-600 tabular-nums">
                      {formatCHF(dashboard.invoicesOverdueAmount)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-gray-900">
                      {t("pendingPayments")}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500">
                      {dashboard.paymentsPendingCount}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 tabular-nums">
                      {formatCHF(dashboard.paymentsTotalPending)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-gray-900">
                      {t("pendingExpenseClaims")}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500">
                      {dashboard.expenseClaimsPendingCount}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 tabular-nums">
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
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {t("recentTransactions")}
            </h2>
            <Link
              href="/finance/transactions"
              className="text-sm font-medium text-orange-600 transition-colors hover:text-orange-700"
            >
              {t("transactions")} &rarr;
            </Link>
          </div>
          {recentTransactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-700">
                      {t("transactionDate")}
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-700">
                      {t("transactionDescription")}
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-700">
                      {t("transactionCategory")}
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-gray-700">
                      {t("transactionAmount")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentTransactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-500 tabular-nums">
                        {new Date(tx.date).toLocaleDateString("de-CH")}
                      </td>
                      <td className="px-4 py-3 text-gray-900">
                        {tx.description}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {tx.categoryName}
                      </td>
                      <td className="px-4 py-3 text-right font-medium whitespace-nowrap text-gray-900 tabular-nums">
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

export function FinanceDashboardContent() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <FinanceDashboardBody />
    </QueryClientProvider>
  );
}
