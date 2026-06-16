"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { budgetingKeys, budgetingUrls } from "../api/budgeting-api";
import type { BudgetVsActualReport } from "../types/budgeting.types";

/**
 * Budget-vs-actual (Soll/Ist) ON-DEMAND report. The god-page only fetches after the user
 * clicks Generate AND a period is selected (`if (!periodId) return`). Modelled as a query
 * `enabled` only when `generate && !!fiscalPeriodId` — so NO GET fires on mount, on a
 * period change alone, or without a period (matching the early-return). The query string is
 * `fiscalPeriodId=&[activityAreaId=]` (area only appended when set). On `res.error` the
 * query throws → the content shows the `loadError` banner. The rows are SERVER-computed (the
 * content renders `report.rows` budget/actual/variance/variancePercent verbatim).
 */
export function useBudgetVsActualReport(params: {
  fiscalPeriodId: string;
  activityAreaId: string;
  generate: boolean;
}) {
  const api = useApiClient();
  return useQuery<BudgetVsActualReport | null>({
    queryKey: budgetingKeys.budgetVsActual(
      params.fiscalPeriodId,
      params.activityAreaId
    ),
    enabled: params.generate && !!params.fiscalPeriodId,
    queryFn: async () => {
      const qs = new URLSearchParams({
        fiscalPeriodId: params.fiscalPeriodId,
      });
      if (params.activityAreaId)
        qs.set("activityAreaId", params.activityAreaId);
      const res = await api.get<BudgetVsActualReport>(
        budgetingUrls.budgetVsActual(qs.toString())
      );
      if (res.error) throw new Error(res.error);
      return res.data ?? null;
    },
  });
}

/**
 * CSV export — a RAW imperative blob download (NOT a TanStack query; A76 highest-risk
 * class). Byte-identical to the god-page: GET the cross-base `/exports/budget-vs-actual?
 * fiscalPeriodId=&[activityAreaId=]` blob → `createObjectURL` → anchor `download=
 * "budget-vs-actual.csv"` → click → `revokeObjectURL`. Throws on `res.error` so the caller
 * surfaces the `exportError` banner.
 */
export async function exportBudgetVsActualCsv(
  api: {
    get: (url: string) => Promise<{ data: unknown; error?: string | null }>;
  },
  params: { fiscalPeriodId: string; activityAreaId: string }
): Promise<void> {
  const qs = new URLSearchParams({ fiscalPeriodId: params.fiscalPeriodId });
  if (params.activityAreaId) qs.set("activityAreaId", params.activityAreaId);
  const res = await api.get(budgetingUrls.budgetVsActualExport(qs.toString()));
  if (res.error) throw new Error(res.error);
  const blob = res.data as Blob;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "budget-vs-actual.csv";
  a.click();
  window.URL.revokeObjectURL(url);
}
