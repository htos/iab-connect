"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import {
  financeKeys,
  receivablesKeys,
  receivablesUrls,
} from "../api/receivables-api";
import type { ClaimFormData, ExpenseClaim } from "../types/receivables.types";

/**
 * Expense-claims list. SERVER filters `?status=&myClaimsOnly=` are part of the key so the
 * query refetches when the filters change (god-page parity). `enabled` = canReadFinance.
 * Throws on res.error → the content's "error" i18n banner.
 */
export function useExpenseClaims(
  status: string,
  myClaimsOnly: boolean,
  enabled: boolean
) {
  const api = useApiClient();
  return useQuery<ExpenseClaim[]>({
    queryKey: receivablesKeys.expenseClaims(status, myClaimsOnly),
    enabled,
    retry: false,
    queryFn: async () => {
      const res = await api.get<{ items: ExpenseClaim[] }>(
        receivablesUrls.expenseClaims(
          status === "all" ? undefined : status,
          myClaimsOnly
        )
      );
      if (res.error) throw new Error(res.error);
      const body = res.data as { items?: ExpenseClaim[] } | null;
      return body?.items ?? [];
    },
  });
}

function invalidateClaims(queryClient: ReturnType<typeof useQueryClient>) {
  // Partial match: invalidate every expense-claims list key regardless of filter.
  queryClient.invalidateQueries({
    queryKey: financeKeys.scope("expense-claims"),
  });
}

/**
 * Create or edit an expense claim. The god-page `handleSave` THROWS on res.error → catch
 * → error banner + the modal STAYS open (A92). So this throws on res.error; the content
 * closes the modal + sets the success banner from onSuccess.
 */
export function useSaveExpenseClaim() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      editingId: string | null;
      payload: Omit<ClaimFormData, "receiptId"> & { receiptId: string | null };
    }) => {
      const res = vars.editingId
        ? await api.put(
            receivablesUrls.expenseClaim(vars.editingId),
            vars.payload
          )
        : await api.post(receivablesUrls.expenseClaimCreate(), vars.payload);
      if (res.error) throw new Error(res.error);
    },
    onSuccess: () => invalidateClaims(queryClient),
  });
}

/**
 * Expense-claim workflow action (submit/review/approve/reject/reimburse/delete). The
 * god-page `handleAction` THROWS on res.error → error banner + the confirm modal STAYS
 * open (A92). So this throws on res.error; the content closes the modal on onSuccess.
 */
export function useExpenseClaimAction() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      type: "submit" | "review" | "approve" | "reject" | "reimburse" | "delete";
      id: string;
      comment?: string;
      reason?: string;
      reimburseMethod?: string;
      reimburseReference?: string | null;
    }) => {
      let res;
      switch (vars.type) {
        case "submit":
          res = await api.post(receivablesUrls.expenseClaimSubmit(vars.id), {});
          break;
        case "review":
          res = await api.post(receivablesUrls.expenseClaimReview(vars.id), {
            comment: vars.comment,
          });
          break;
        case "approve":
          res = await api.post(receivablesUrls.expenseClaimApprove(vars.id), {
            comment: vars.comment,
          });
          break;
        case "reject":
          res = await api.post(receivablesUrls.expenseClaimReject(vars.id), {
            reason: vars.reason,
          });
          break;
        case "reimburse":
          res = await api.post(receivablesUrls.expenseClaimReimburse(vars.id), {
            method: vars.reimburseMethod,
            reference: vars.reimburseReference || null,
            notes: vars.comment || null,
          });
          break;
        case "delete":
          res = await api.delete(receivablesUrls.expenseClaim(vars.id));
          break;
      }
      if (res?.error) throw new Error(res.error);
    },
    onSuccess: () => invalidateClaims(queryClient),
  });
}
