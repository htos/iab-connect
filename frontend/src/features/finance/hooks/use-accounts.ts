"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { financeKeys, financeUrls } from "../api/finance-api";
import type {
  OperatingAccount,
  OperatingAccountForm,
} from "../types/finance.types";

/**
 * Operating-accounts (cash/bank) list. The god-page reads `{ items }` and throws into
 * its catch on `res.error` (→ loadError banner). `enabled` mirrors the lean
 * `canReadFinance` guard so no GET fires for a denied user.
 */
export function useAccounts(enabled: boolean) {
  const api = useApiClient();
  return useQuery<OperatingAccount[]>({
    queryKey: financeKeys.accounts(),
    enabled,
    queryFn: async () => {
      const res = await api.get<{ items: OperatingAccount[] }>(
        financeUrls.accounts()
      );
      if (res.error) throw new Error(res.error);
      const body = res.data as { items?: OperatingAccount[] };
      return body?.items ?? [];
    },
  });
}

/**
 * Create/update an operating account. A56 SILENT-SWALLOW: the god-page `handleSave`
 * does NOT inspect `res.error` — it closes the modal + refetches regardless. So the
 * mutationFn does NOT throw on `res.error`; it always resolves, the content closes the
 * modal in `onSuccess`, and `invalidateQueries` refetches. (A throw would still occur
 * only for a real rejected promise, matching the god-page's `try/catch`.)
 */
export function useSaveAccount() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string | null;
      form: OperatingAccountForm;
    }) => {
      if (vars.id) {
        await api.put(financeUrls.account(vars.id), vars.form);
      } else {
        await api.post(financeUrls.accounts(), vars.form);
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: financeKeys.accounts() }),
  });
}

/** Delete an operating account. A56 SILENT-SWALLOW (same as save). */
export function useDeleteAccount() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(financeUrls.account(id));
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: financeKeys.accounts() }),
  });
}
