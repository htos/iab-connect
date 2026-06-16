"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { financeKeys, financeUrls } from "../api/finance-api";
import type {
  DashboardTransaction,
  FinanceDashboard,
  FinanceDashboardData,
  OpenInvoice,
  TransactionSummary,
} from "../types/finance.types";

/**
 * Dashboard composite query — the four GETs the god-page issued via `Promise.all`
 * (summary / dashboard / open-invoices / recent-transactions) folded into one bag.
 * Preserves the god-page's tolerant shaping: open-invoices is reduced client-side into
 * `{ count, totalAmount }`; transactions is read from `{ items }` and sliced to 10.
 * `enabled` mirrors the canonical guard (`isAuthenticated && canReadFinance`) so no GET
 * fires for a denied user (A97).
 */
export function useFinanceDashboard(enabled: boolean) {
  const api = useApiClient();
  return useQuery<FinanceDashboardData>({
    queryKey: financeKeys.dashboard(),
    enabled,
    queryFn: async () => {
      const [summaryRes, dashboardRes, invoicesRes, transactionsRes] =
        await Promise.all([
          api.get<TransactionSummary>(financeUrls.transactionsSummary()),
          api.get<FinanceDashboard>(financeUrls.dashboard()),
          api.get<OpenInvoice[]>(financeUrls.invoicesOpen()),
          api.get<DashboardTransaction[]>(financeUrls.transactions()),
        ]);

      if (
        summaryRes.error ||
        dashboardRes.error ||
        invoicesRes.error ||
        transactionsRes.error
      ) {
        throw new Error(
          summaryRes.error ||
            dashboardRes.error ||
            invoicesRes.error ||
            transactionsRes.error ||
            "error"
        );
      }

      const invoiceList = (invoicesRes.data as OpenInvoice[]) ?? [];
      const txBody = transactionsRes.data as unknown as {
        items?: DashboardTransaction[];
      };

      return {
        summary: (summaryRes.data as TransactionSummary) ?? null,
        dashboard: (dashboardRes.data as FinanceDashboard) ?? null,
        openInvoices: invoicesRes.data
          ? {
              count: invoiceList.length,
              totalAmount: invoiceList.reduce((sum, inv) => sum + inv.total, 0),
            }
          : null,
        recentTransactions: (txBody?.items ?? []).slice(0, 10),
      };
    },
  });
}
