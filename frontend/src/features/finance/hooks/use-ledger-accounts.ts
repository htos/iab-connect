"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { financeKeys, financeUrls } from "../api/finance-api";
import type { LedgerAccount } from "../types/finance.types";

/** Payload the ledger-account save sends (god-page `payload` shape, byte-identical). */
export interface LedgerAccountPayload {
  number: string;
  name: string;
  accountClass: string;
  normalBalance: string;
  description: string | null;
  parentAccountId: string | null;
  sortOrder: number;
}

/**
 * Ledger-accounts (double-entry chart) list. Tolerant of a raw array OR `{ items }`
 * (god-page parity). `enabled` is gated on `modeChecked && canReadFinance` (A97) — the
 * DoubleEntry mode guard runs as an imperative effect in the content.
 */
export function useLedgerAccounts(enabled: boolean) {
  const api = useApiClient();
  return useQuery<LedgerAccount[]>({
    queryKey: financeKeys.ledgerAccounts(),
    enabled,
    queryFn: async () => {
      const res = await api.get(financeUrls.ledgerAccounts());
      if (res.error) throw new Error(res.error);
      const data = res.data;
      return Array.isArray(data)
        ? (data as LedgerAccount[])
        : ((data as { items?: LedgerAccount[] })?.items ?? []);
    },
  });
}

/**
 * Create/update a ledger account. A56 ASYMMETRY: the god-page `handleSave` INSPECTS
 * `res.error` (`setError(res.error); return` — KEEPS THE MODAL OPEN). So the mutationFn
 * THROWS the raw `res.error` string; the content's `onError` surfaces `error.message`
 * (the raw server string) and keeps the modal open (A92 — driven from the outcome).
 */
export function useSaveLedgerAccount() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string | null;
      payload: LedgerAccountPayload;
    }) => {
      const res = vars.id
        ? await api.put(financeUrls.ledgerAccount(vars.id), vars.payload)
        : await api.post(financeUrls.ledgerAccounts(), vars.payload);
      if (res.error) throw new Error(res.error);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: financeKeys.ledgerAccounts(),
      }),
  });
}

/** Delete a ledger account. A56 SILENT-SWALLOW (god-page `handleDelete` ignores res.error). */
export function useDeleteLedgerAccount() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(financeUrls.ledgerAccount(id));
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: financeKeys.ledgerAccounts(),
      }),
  });
}
