"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { budgetingKeys, budgetingUrls } from "../api/budgeting-api";
import type { BudgetDto, FinanceCurrency } from "../types/budgeting.types";

/**
 * Budgets list (server-filtered by `?activityAreaId=&fiscalPeriodId=`). The god-page
 * builds the query string with URLSearchParams (only set filters appended) and throws into
 * its catch on `res.error` (→ `error` banner). The data is a RAW `BudgetDto[]` array (NOT
 * an `{ items }` envelope). `enabled` mirrors the `!authLoading && canReadFinance` gate so
 * no GET fires for a denied user.
 */
export function useBudgets(
  filters: { activityAreaId: string; fiscalPeriodId: string },
  enabled: boolean
) {
  const api = useApiClient();
  return useQuery<BudgetDto[]>({
    queryKey: budgetingKeys.budgets(filters),
    enabled,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.activityAreaId)
        params.set("activityAreaId", filters.activityAreaId);
      if (filters.fiscalPeriodId)
        params.set("fiscalPeriodId", filters.fiscalPeriodId);
      const res = await api.get<BudgetDto[]>(
        budgetingUrls.budgetsFiltered(params.toString())
      );
      if (res.error) throw new Error(res.error);
      return res.data ?? [];
    },
  });
}

export interface SaveBudgetVars {
  editingId: string | null;
  activityAreaId: string;
  fiscalPeriodId: string;
  amount: number;
  currency: FinanceCurrency;
  notes: string | null;
}

/**
 * Create/update a budget. On create POSTs `{activityAreaId, fiscalPeriodId, amount,
 * currency, notes}`; on edit PUTs `{amount, currency, notes}` to `/{id}` (area/period are
 * disabled-on-edit, so the PUT payload omits them — A95). On `res.error` it THROWS the
 * server error VERBATIM (`new Error(res.error)`) so the content surfaces `e.message` (the
 * god-page's save catch shows the thrown message, not the i18n key). On success the content
 * sets the success banner + closes the dialog (A92 — from the mutation OUTCOME).
 */
export function useSaveBudget() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: SaveBudgetVars) => {
      if (vars.editingId) {
        const res = await api.put(budgetingUrls.budget(vars.editingId), {
          amount: vars.amount,
          currency: vars.currency,
          notes: vars.notes,
        });
        if (res.error) throw new Error(res.error);
      } else {
        const res = await api.post(budgetingUrls.budgets(), {
          activityAreaId: vars.activityAreaId,
          fiscalPeriodId: vars.fiscalPeriodId,
          amount: vars.amount,
          currency: vars.currency,
          notes: vars.notes,
        });
        if (res.error) throw new Error(res.error);
      }
    },
    // Invalidate the budgets PREFIX so every filter-variant list refetches.
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["finance", "budgets"],
      }),
  });
}

/**
 * Delete a budget. On `res.error` THROWS so the content maps to the `deleteError` i18n key
 * (the god-page's delete catch SWALLOWS the thrown message → shows the key). The inline
 * confirm state is preserved on failure by the content (it only clears `confirmDeleteId` in
 * the success path).
 */
export function useDeleteBudget() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(budgetingUrls.budget(id));
      if (res.error) throw new Error(res.error);
    },
    // Invalidate the budgets PREFIX so every filter-variant list refetches.
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["finance", "budgets"],
      }),
  });
}
