"use client";

/**
 * Accounting Reports content (E26-S2 migration of `app/finance/accounting-reports/page.tsx`).
 * Composition root (only `"use client"`) — self-embeds its own `QueryClientProvider`.
 *
 * Read-only, 3 tabs (trial-balance / balance-sheet / profit-and-loss) + date filters +
 * the client-side PDF print (preserved verbatim). Lean read guard + DoubleEntry mode
 * guard; render-time `if (!canReadFinance || !modeChecked) return null` (BLANK). NO
 * report is fetched on mount — only on the Generate click (Generate-driven, A56).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import { useDoubleEntryGuard } from "../hooks/use-double-entry-guard";
import { useAccountingReports } from "../hooks/use-accounting-reports";
import type {
  BalanceSheetReport,
  ProfitAndLossReport,
  TrialBalanceReport,
} from "../types/finance.types";

type ReportTab = "trialBalance" | "balanceSheet" | "profitAndLoss";

/** Opens a popup window with a formatted report and triggers the browser print dialog
 * (Save as PDF). Preserved verbatim from the god-page. */
function printReport(title: string, subtitle: string, bodyHtml: string) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>${title}</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;margin:2rem;color:#111}
  h1{font-size:1.4rem;margin:0 0 .2rem}
  p.sub{font-size:.85rem;color:#666;margin:0 0 1.5rem}
  table{width:100%;border-collapse:collapse;font-size:.85rem}
  th{text-align:left;border-bottom:2px solid #333;padding:6px 8px;font-weight:600}
  th.right,td.right{text-align:right}
  td{padding:5px 8px;border-bottom:1px solid #ddd}
  tfoot td{border-top:2px solid #333;font-weight:700}
  .section{margin-top:1.5rem}
  .section-title{font-size:1.1rem;font-weight:600;margin-bottom:.5rem}
  .result{margin-top:1.5rem;padding:8px 0;border-top:2px solid #333;display:flex;justify-content:space-between;font-weight:700;font-size:1.1rem}
  .neg{color:#dc2626}
  @media print{body{margin:1cm}}
</style></head><body>
<h1>${title}</h1>
<p class="sub">${subtitle}</p>
${bodyHtml}
<script>window.onload=function(){window.print()}<\/script>
</body></html>`);
  win.document.close();
}

function AccountingReportsBody() {
  const t = useTranslations("finance");
  const ta = useTranslations("finance.accounting");
  const router = useRouter();
  const { canReadFinance } = useAuth();

  const modeChecked = useDoubleEntryGuard(router.replace);
  const { fetchTrialBalance, fetchBalanceSheet, fetchProfitAndLoss } =
    useAccountingReports();

  const [activeTab, setActiveTab] = useState<ReportTab>("trialBalance");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [asOfDate, setAsOfDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [trialBalance, setTrialBalance] = useState<TrialBalanceReport | null>(
    null
  );
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetReport | null>(
    null
  );
  const [profitAndLoss, setProfitAndLoss] =
    useState<ProfitAndLossReport | null>(null);

  useEffect(() => {
    if (!canReadFinance) {
      router.replace("/");
    }
  }, [canReadFinance, router]);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "trialBalance") {
        setTrialBalance(await fetchTrialBalance(from, to));
      } else if (activeTab === "balanceSheet") {
        setBalanceSheet(await fetchBalanceSheet(asOfDate));
      } else {
        setProfitAndLoss(await fetchProfitAndLoss(from, to));
      }
    } catch {
      setError(t("loadError"));
    } finally {
      setLoading(false);
    }
  };

  const hasReportData =
    (activeTab === "trialBalance" && trialBalance) ||
    (activeTab === "balanceSheet" && balanceSheet) ||
    (activeTab === "profitAndLoss" && profitAndLoss);

  const handlePrint = () => {
    const fmtAmt = (v: number) =>
      new Intl.NumberFormat("de-CH", {
        style: "currency",
        currency: "CHF",
      }).format(v);
    const dateRange =
      from && to
        ? `${from} – ${to}`
        : from
          ? `ab ${from}`
          : to
            ? `bis ${to}`
            : ta("allPeriods");

    if (activeTab === "trialBalance" && trialBalance) {
      const rows = trialBalance.lines
        .map(
          (r) =>
            `<tr><td>${r.accountNumber}</td><td>${r.accountName}</td><td>${r.accountClass}</td><td class="right">${fmtAmt(r.totalDebit)}</td><td class="right">${fmtAmt(r.totalCredit)}</td><td class="right${r.balance < 0 ? " neg" : ""}">${fmtAmt(r.balance)}</td></tr>`
        )
        .join("");
      printReport(
        ta("trialBalance"),
        dateRange,
        `<table><thead><tr><th>${ta("accountNumber")}</th><th>${ta("accountName")}</th><th>${ta("accountClass")}</th><th class="right">${ta("totalDebitCol")}</th><th class="right">${ta("totalCreditCol")}</th><th class="right">${ta("balanceCol")}</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="3">${t("total")}</td><td class="right">${fmtAmt(trialBalance.totalDebit)}</td><td class="right">${fmtAmt(trialBalance.totalCredit)}</td><td class="right">${fmtAmt(trialBalance.totalDebit - trialBalance.totalCredit)}</td></tr></tfoot></table>`
      );
    } else if (activeTab === "balanceSheet" && balanceSheet) {
      const section = (
        title: string,
        rows: { accountNumber: string; accountName: string; balance: number }[],
        total: number
      ) => {
        const body = rows
          .map(
            (r) =>
              `<tr><td>${r.accountNumber}</td><td>${r.accountName}</td><td class="right${r.balance < 0 ? " neg" : ""}">${fmtAmt(r.balance)}</td></tr>`
          )
          .join("");
        return `<div class="section"><div class="section-title">${title}</div><table><thead><tr><th>${ta("accountNumber")}</th><th>${ta("accountName")}</th><th class="right">${ta("balanceCol")}</th></tr></thead><tbody>${body}</tbody><tfoot><tr><td colspan="2">${ta("sectionTotal")}</td><td class="right">${fmtAmt(total)}</td></tr></tfoot></table></div>`;
      };
      printReport(
        ta("balanceSheet"),
        `${ta("asOfDate")}: ${asOfDate}`,
        section(ta("assets"), balanceSheet.assets, balanceSheet.totalAssets) +
          section(
            ta("liabilities"),
            balanceSheet.liabilities,
            balanceSheet.totalLiabilities
          ) +
          section(ta("equity"), balanceSheet.equity, balanceSheet.totalEquity)
      );
    } else if (activeTab === "profitAndLoss" && profitAndLoss) {
      const section = (
        title: string,
        rows: { accountNumber: string; accountName: string; amount: number }[],
        total: number
      ) => {
        const body = rows
          .map(
            (r) =>
              `<tr><td>${r.accountNumber}</td><td>${r.accountName}</td><td class="right">${fmtAmt(Math.abs(r.amount))}</td></tr>`
          )
          .join("");
        return `<div class="section"><div class="section-title">${title}</div><table><thead><tr><th>${ta("accountNumber")}</th><th>${ta("accountName")}</th><th class="right">${t("amount")}</th></tr></thead><tbody>${body}</tbody><tfoot><tr><td colspan="2">${ta("sectionTotal")}</td><td class="right">${fmtAmt(Math.abs(total))}</td></tr></tfoot></table></div>`;
      };
      printReport(
        ta("profitAndLoss"),
        dateRange,
        section(
          ta("revenue"),
          profitAndLoss.revenue,
          profitAndLoss.totalRevenue
        ) +
          section(
            ta("expenses"),
            profitAndLoss.expenses,
            profitAndLoss.totalExpenses
          ) +
          `<div class="result"><span>${ta("netResult")}</span><span class="${profitAndLoss.netResult < 0 ? "neg" : ""}">${fmtAmt(profitAndLoss.netResult)}</span></div>`
      );
    }
  };

  const tabs: { key: ReportTab; label: string }[] = [
    { key: "trialBalance", label: ta("trialBalance") },
    { key: "balanceSheet", label: ta("balanceSheet") },
    { key: "profitAndLoss", label: ta("profitAndLoss") },
  ];

  if (!canReadFinance || !modeChecked) return null;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Back */}
        <Link
          href="/finance"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {t("back")}
        </Link>

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{ta("reports")}</h1>
          <p className="mt-1 text-sm text-gray-500">{ta("reportsSubtitle")}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-white text-orange-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-end gap-4 rounded-xl bg-white p-4 shadow-sm">
          {activeTab === "balanceSheet" ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {ta("asOfDate")}
              </label>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("from")}
                </label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("to")}
                </label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>
            </>
          )}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
          >
            {loading ? "..." : ta("generate")}
          </button>
          {hasReportData && (
            <button
              onClick={handlePrint}
              className="rounded-lg border border-orange-600 px-4 py-2 text-sm font-medium text-orange-600 transition-colors hover:bg-orange-50"
            >
              {ta("downloadPdf")}
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
          </div>
        )}

        {/* Trial Balance */}
        {activeTab === "trialBalance" && trialBalance && !loading && (
          <div className="overflow-x-auto rounded-xl bg-white p-6 shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="pb-3 font-medium">{ta("accountNumber")}</th>
                  <th className="pb-3 font-medium">{ta("accountName")}</th>
                  <th className="pb-3 font-medium">{ta("accountClass")}</th>
                  <th className="pb-3 text-right font-medium">
                    {ta("totalDebitCol")}
                  </th>
                  <th className="pb-3 text-right font-medium">
                    {ta("totalCreditCol")}
                  </th>
                  <th className="pb-3 text-right font-medium">
                    {ta("balanceCol")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {trialBalance.lines.map((row) => (
                  <tr key={row.ledgerAccountId}>
                    <td className="py-2 font-mono">{row.accountNumber}</td>
                    <td className="py-2">{row.accountName}</td>
                    <td className="py-2 text-gray-500">{row.accountClass}</td>
                    <td className="py-2 text-right font-mono">
                      {formatCurrency(row.totalDebit)}
                    </td>
                    <td className="py-2 text-right font-mono">
                      {formatCurrency(row.totalCredit)}
                    </td>
                    <td
                      className={`py-2 text-right font-mono font-medium ${row.balance < 0 ? "text-red-600" : ""}`}
                    >
                      {formatCurrency(row.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 font-semibold">
                  <td colSpan={3} className="py-2">
                    {t("total")}
                  </td>
                  <td className="py-2 text-right font-mono">
                    {formatCurrency(trialBalance.totalDebit)}
                  </td>
                  <td className="py-2 text-right font-mono">
                    {formatCurrency(trialBalance.totalCredit)}
                  </td>
                  <td className="py-2 text-right font-mono">
                    {formatCurrency(
                      trialBalance.totalDebit - trialBalance.totalCredit
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Balance Sheet */}
        {activeTab === "balanceSheet" && balanceSheet && !loading && (
          <div className="space-y-6">
            {[
              {
                rows: balanceSheet.assets,
                title: ta("assets"),
                total: balanceSheet.totalAssets,
              },
              {
                rows: balanceSheet.liabilities,
                title: ta("liabilities"),
                total: balanceSheet.totalLiabilities,
              },
              {
                rows: balanceSheet.equity,
                title: ta("equity"),
                total: balanceSheet.totalEquity,
              },
            ].map(({ rows, title, total }) => (
              <div
                key={title}
                className="overflow-x-auto rounded-xl bg-white p-6 shadow-sm"
              >
                <h3 className="mb-3 text-lg font-semibold text-gray-900">
                  {title}
                </h3>
                {rows.length === 0 ? (
                  <p className="text-sm text-gray-500">{ta("noReportData")}</p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-500">
                        <th className="pb-2 font-medium">
                          {ta("accountNumber")}
                        </th>
                        <th className="pb-2 font-medium">
                          {ta("accountName")}
                        </th>
                        <th className="pb-2 text-right font-medium">
                          {ta("balanceCol")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((row) => (
                        <tr key={row.ledgerAccountId}>
                          <td className="py-2 font-mono">
                            {row.accountNumber}
                          </td>
                          <td className="py-2">{row.accountName}</td>
                          <td
                            className={`py-2 text-right font-mono ${row.balance < 0 ? "text-red-600" : ""}`}
                          >
                            {formatCurrency(row.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 font-semibold">
                        <td colSpan={2} className="py-2">
                          {ta("sectionTotal")}
                        </td>
                        <td
                          className={`py-2 text-right font-mono ${total < 0 ? "text-red-600" : ""}`}
                        >
                          {formatCurrency(total)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Profit & Loss */}
        {activeTab === "profitAndLoss" && profitAndLoss && !loading && (
          <div className="space-y-6">
            {[
              {
                rows: profitAndLoss.revenue,
                title: ta("revenue"),
                total: profitAndLoss.totalRevenue,
              },
              {
                rows: profitAndLoss.expenses,
                title: ta("expenses"),
                total: profitAndLoss.totalExpenses,
              },
            ].map(({ rows, title, total }) => (
              <div
                key={title}
                className="overflow-x-auto rounded-xl bg-white p-6 shadow-sm"
              >
                <h3 className="mb-3 text-lg font-semibold text-gray-900">
                  {title}
                </h3>
                {rows.length === 0 ? (
                  <p className="text-sm text-gray-500">{ta("noReportData")}</p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-500">
                        <th className="pb-2 font-medium">
                          {ta("accountNumber")}
                        </th>
                        <th className="pb-2 font-medium">
                          {ta("accountName")}
                        </th>
                        <th className="pb-2 text-right font-medium">
                          {t("amount")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((row) => (
                        <tr key={row.ledgerAccountId}>
                          <td className="py-2 font-mono">
                            {row.accountNumber}
                          </td>
                          <td className="py-2">{row.accountName}</td>
                          <td className="py-2 text-right font-mono">
                            {formatCurrency(Math.abs(row.amount))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 font-semibold">
                        <td colSpan={2} className="py-2">
                          {ta("sectionTotal")}
                        </td>
                        <td className="py-2 text-right font-mono">
                          {formatCurrency(Math.abs(total))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            ))}

            {/* Net Result */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {ta("netResult")}
                </h3>
                <span
                  className={`text-2xl font-bold ${profitAndLoss.netResult >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {formatCurrency(profitAndLoss.netResult)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* No data */}
        {!loading &&
          !error &&
          ((activeTab === "trialBalance" && !trialBalance) ||
            (activeTab === "balanceSheet" && !balanceSheet) ||
            (activeTab === "profitAndLoss" && !profitAndLoss)) && (
            <div className="rounded-xl bg-white p-6 text-center text-gray-500 shadow-sm">
              {ta("noReportData")}
            </div>
          )}
      </div>
    </main>
  );
}

export function AccountingReportsContent() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <AccountingReportsBody />
    </QueryClientProvider>
  );
}
