"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { bankingKeys, bankingUrls } from "../api/banking-api";
import { financeKeys } from "../api/finance-api";
import type {
  Transaction,
  TransactionAccount,
  TransactionActivityArea,
  TransactionCategory,
  TransactionFilters,
  TransactionPayload,
} from "../types/banking.types";

// Transactions queries + mutations (E26-S5). The list query keys on the server-filter
// object (client search is applied during render in the component). The create/edit/
// delete mutations invalidate the list. The receipt attach/detach mutations also
// invalidate the list (the god-page `fetchTransactions()` re-load after each).

/**
 * Transactions list (server filters). Keyed on the filter object; the bare `/transactions`
 * URL is emitted when no filter is set (pinned). The god-page sets `error` from `res.error`
 * and reads `{ items }` — the content surfaces a load error from the query's `error`.
 */
export function useTransactions(enabled: boolean, filters: TransactionFilters) {
  const api = useApiClient();
  return useQuery<Transaction[]>({
    queryKey: bankingKeys.transactions(filters),
    enabled,
    queryFn: async () => {
      const res = await api.get<{ items: Transaction[] }>(
        bankingUrls.transactions(filters)
      );
      if (res.error) throw new Error(res.error);
      const body = res.data as { items?: Transaction[] };
      return body?.items ?? [];
    },
  });
}

/** Accounts selector (`{ items }`; god-page only sets state on `res.data`). */
export function useTransactionAccounts(enabled: boolean) {
  const api = useApiClient();
  return useQuery<TransactionAccount[]>({
    queryKey: financeKeys.accounts(),
    enabled,
    queryFn: async () => {
      const res = await api.get<{ items: TransactionAccount[] }>(
        bankingUrls.accounts()
      );
      const body = res.data as { items?: TransactionAccount[] } | null;
      return body?.items ?? [];
    },
  });
}

/** Categories selector (`{ items }`). */
export function useTransactionCategories(enabled: boolean) {
  const api = useApiClient();
  return useQuery<TransactionCategory[]>({
    queryKey: financeKeys.categories(),
    enabled,
    queryFn: async () => {
      const res = await api.get<{ items: TransactionCategory[] }>(
        bankingUrls.categories()
      );
      const body = res.data as { items?: TransactionCategory[] } | null;
      return body?.items ?? [];
    },
  });
}

/**
 * Activity-areas selector. The god-page filters `isActive` and sorts by `sortOrder`
 * before rendering the `<select>` — preserved here so the rendered option set is
 * byte-identical.
 */
export function useTransactionActivityAreas(enabled: boolean) {
  const api = useApiClient();
  return useQuery<TransactionActivityArea[]>({
    queryKey: financeKeys.activityAreas(),
    enabled,
    queryFn: async () => {
      const res = await api.get<{ items: TransactionActivityArea[] }>(
        bankingUrls.activityAreas()
      );
      const body = res.data as { items?: TransactionActivityArea[] } | null;
      return (body?.items ?? [])
        .filter((a) => a.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    },
  });
}

/**
 * Create or edit a transaction. POST /transactions or PUT /transactions/{id} with the
 * JSON payload (A96: the component trims description/reference/notes at payload-build
 * time, byte-identical to the god-page). Returns the `{ error }` so the form keeps the
 * modal open + surfaces the error on `res.error` (the god-page does NOT close on error).
 */
export function useSaveTransaction() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string | null;
      payload: TransactionPayload;
    }) => {
      const res = vars.id
        ? await api.put(bankingUrls.transaction(vars.id), vars.payload)
        : await api.post(bankingUrls.transactions(), vars.payload);
      return res;
    },
    onSuccess: (res) => {
      // Only refetch the list when the write actually succeeded (god-page parity:
      // `if (res.error) { setFormError; return; }` skips the refetch).
      if (!res.error) {
        queryClient.invalidateQueries({
          queryKey: financeKeys.scope("transactions"),
        });
      }
    },
  });
}

/** Delete a transaction. DELETE /transactions/{id}. */
export function useDeleteTransaction() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(bankingUrls.transaction(id)),
    onSuccess: (res) => {
      if (!res.error) {
        queryClient.invalidateQueries({
          queryKey: financeKeys.scope("transactions"),
        });
      }
    },
  });
}

/** Link an (existing or freshly-uploaded) receipt: POST /transactions/{id}/receipt. */
export function useAttachReceipt() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { transactionId: string; receiptId: string }) =>
      api.post(bankingUrls.transactionReceipt(vars.transactionId), {
        receiptId: vars.receiptId,
      }),
    onSuccess: (res) => {
      if (!res.error) {
        queryClient.invalidateQueries({
          queryKey: financeKeys.scope("transactions"),
        });
      }
    },
  });
}

/** Detach a receipt (immediate, no confirm): DELETE /transactions/{id}/receipt. */
export function useDetachReceipt() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (transactionId: string) =>
      api.delete(bankingUrls.transactionReceipt(transactionId)),
    onSuccess: (res) => {
      if (!res.error) {
        queryClient.invalidateQueries({
          queryKey: financeKeys.scope("transactions"),
        });
      }
    },
  });
}
