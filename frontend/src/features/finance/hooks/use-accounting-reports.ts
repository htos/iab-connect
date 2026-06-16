"use client";

import { useCallback } from "react";
import { useApiClient } from "@/lib/auth";
import { financeUrls } from "../api/finance-api";
import type {
  BalanceSheetReport,
  ProfitAndLossReport,
  TrialBalanceReport,
} from "../types/finance.types";

/**
 * Accounting-reports fetchers. The god-page does NOT auto-load any report on mount —
 * each report is fetched ONLY on the Generate click (Generate-driven). So these are
 * imperative fetchers (not auto-queries): the content owns the three report states +
 * the loading/error flags + the client-side PDF print, exactly as the god-page did. The
 * URLSearchParams (from/to or asOfDate) are built here so the query strings stay
 * byte-identical (trial-balance?from=&to= / balance-sheet?asOfDate= / p&l?from=&to=).
 */
export function useAccountingReports() {
  const api = useApiClient();

  const fetchTrialBalance = useCallback(
    async (from: string, to: string): Promise<TrialBalanceReport> => {
      const params = new URLSearchParams();
      if (from) params.append("from", from);
      if (to) params.append("to", to);
      const res = await api.get<TrialBalanceReport>(
        financeUrls.trialBalance(params.toString())
      );
      if (res.error) throw new Error(res.error);
      const data = res.data as TrialBalanceReport;
      return { ...data, lines: data.lines ?? [] };
    },
    [api]
  );

  const fetchBalanceSheet = useCallback(
    async (asOfDate: string): Promise<BalanceSheetReport> => {
      const params = new URLSearchParams();
      if (asOfDate) params.append("asOfDate", asOfDate);
      const res = await api.get<BalanceSheetReport>(
        financeUrls.balanceSheet(params.toString())
      );
      if (res.error) throw new Error(res.error);
      const data = res.data as BalanceSheetReport;
      return {
        ...data,
        assets: data.assets ?? [],
        liabilities: data.liabilities ?? [],
        equity: data.equity ?? [],
      };
    },
    [api]
  );

  const fetchProfitAndLoss = useCallback(
    async (from: string, to: string): Promise<ProfitAndLossReport> => {
      const params = new URLSearchParams();
      if (from) params.append("from", from);
      if (to) params.append("to", to);
      const res = await api.get<ProfitAndLossReport>(
        financeUrls.profitAndLoss(params.toString())
      );
      if (res.error) throw new Error(res.error);
      const data = res.data as ProfitAndLossReport;
      return {
        ...data,
        revenue: data.revenue ?? [],
        expenses: data.expenses ?? [],
      };
    },
    [api]
  );

  return { fetchTrialBalance, fetchBalanceSheet, fetchProfitAndLoss };
}
