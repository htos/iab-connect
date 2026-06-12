"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { financeKeys, financeUrls } from "../api/finance-api";
import type { FiscalPeriod } from "../types/finance.types";

/**
 * Fiscal-periods list (server-filtered by `?year=`). `enabled` mirrors the god-page
 * fetch precondition (`!authLoading && canReadFinance`) — note this page has NO
 * DoubleEntry mode guard and NO router. The god-page reads `{ items }` and surfaces a
 * generic `error` banner on `res.error`.
 */
export function useFiscalPeriods(year: number, enabled: boolean) {
  const api = useApiClient();
  return useQuery<FiscalPeriod[]>({
    queryKey: financeKeys.fiscalPeriods(year),
    enabled,
    queryFn: async () => {
      const res = await api.get<FiscalPeriod[]>(
        financeUrls.fiscalPeriods(year)
      );
      if (res.error) throw new Error(res.error);
      const body = res.data as unknown as { items?: FiscalPeriod[] };
      return body?.items ?? [];
    },
  });
}

/**
 * Carries the response status so the content can reproduce the god-page's 409
 * "finance profile" → `noProfileError` amber-panel branch (vs the generic error banner).
 */
export class FiscalActionError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "FiscalActionError";
  }
}

/**
 * Generate periods for the selected year. POSTs `{ year }`. On `res.error` it throws a
 * `FiscalActionError` carrying the status so the content can branch: 409 + "finance
 * profile" → amber `noProfileError` panel; else → red error banner. On success the
 * content sets the 4s auto-dismiss success banner and seeds the list from the response.
 */
export function useGenerateFiscalPeriods() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<FiscalPeriod[], FiscalActionError, number>({
    mutationFn: async (year: number) => {
      const res = await api.post<FiscalPeriod[]>(
        financeUrls.fiscalPeriodsGenerate(),
        { year }
      );
      if (res.error) {
        throw new FiscalActionError(res.error, res.status ?? 0);
      }
      return res.data ?? [];
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: financeKeys.scope("fiscal-periods"),
      }),
  });
}

type FiscalActionType = "close" | "reopen" | "lock" | "unlock";

/**
 * Close / reopen / lock / unlock a fiscal period. A56: failure sets the error BANNER on
 * `res.error` (the mutation throws → content `onError`) but the content STILL CLOSES the
 * modal in `onSettled` (the god-page closed it in `finally`). close/lock carry
 * `{ notes }`; reopen/unlock carry `{}`.
 */
export function useFiscalPeriodAction() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      type: FiscalActionType;
      id: string;
      notes?: string | null;
    }) => {
      let endpoint: string;
      let body: Record<string, unknown> = {};
      switch (vars.type) {
        case "close":
          endpoint = financeUrls.fiscalPeriodClose(vars.id);
          body = { notes: vars.notes || null };
          break;
        case "lock":
          endpoint = financeUrls.fiscalPeriodLock(vars.id);
          body = { notes: vars.notes || null };
          break;
        case "reopen":
          endpoint = financeUrls.fiscalPeriodReopen(vars.id);
          body = {};
          break;
        case "unlock":
        default:
          endpoint = financeUrls.fiscalPeriodUnlock(vars.id);
          body = {};
          break;
      }
      const res = await api.post<FiscalPeriod>(endpoint, body);
      if (res.error) throw new Error(res.error);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: financeKeys.scope("fiscal-periods"),
      }),
  });
}
