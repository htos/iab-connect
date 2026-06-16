"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { financeKeys, financeUrls } from "../api/finance-api";
import type { JournalEntry } from "../types/finance.types";

/** Journal-entry create/update payload (god-page `payload` shape, byte-identical). */
export interface JournalEntryPayload {
  date: string;
  description: string;
  reference: string | null;
  lines: Array<{
    ledgerAccountId: string;
    debitAmount: number;
    creditAmount: number;
    taxCodeId: string | null;
    netAmount: number;
    taxAmount: number;
    activityAreaId: string | null;
  }>;
}

/**
 * Journal-entries list. SERVER-side status filter (`?status=<S>`) is part of the key so
 * the query refetches when the filter changes (god-page parity). Tolerant of array OR
 * `{ items }`. `enabled` gated on `modeChecked && canReadFinance` (A97).
 */
export function useJournalEntries(status: string, enabled: boolean) {
  const api = useApiClient();
  return useQuery<JournalEntry[]>({
    queryKey: financeKeys.journalEntries(status),
    enabled,
    queryFn: async () => {
      const res = await api.get(
        financeUrls.journalEntries(status || undefined)
      );
      if (res.error) throw new Error(res.error);
      const data = res.data;
      return Array.isArray(data)
        ? (data as JournalEntry[])
        : ((data as { items?: JournalEntry[] })?.items ?? []);
    },
  });
}

/**
 * Journal-entry detail / edit-load query. A99: `retry: false` — the god-page silently
 * returns on `res.error` (no status sentinel), so a failure must NOT retry. `enabled` is
 * `!!id` so the query only runs once a row is opened.
 */
export function useJournalEntryDetail(id: string | null) {
  const api = useApiClient();
  return useQuery<JournalEntry>({
    queryKey: financeKeys.journalEntry(id ?? ""),
    enabled: !!id,
    retry: false,
    queryFn: async () => {
      const res = await api.get<JournalEntry>(
        financeUrls.journalEntry(id as string)
      );
      if (res.error || !res.data) throw new Error(res.error || "not-found");
      return res.data as JournalEntry;
    },
  });
}

/**
 * Create/update a journal entry. A56: the god-page `handleSave` THROWS on `res.error`
 * → catch → `setError(saveError)` + KEEPS THE MODAL OPEN. The mutationFn throws; the
 * content's `onError` sets the saveError banner and leaves the modal open.
 */
export function useSaveJournalEntry() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string | null;
      payload: JournalEntryPayload;
    }) => {
      const res = vars.id
        ? await api.put(financeUrls.journalEntry(vars.id), vars.payload)
        : await api.post(financeUrls.journalEntries(), vars.payload);
      if (res.error) throw new Error(res.error);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: financeKeys.scope("journal-entries"),
      }),
  });
}

/**
 * Post / reverse a journal entry — both are POSTs to the action sub-path with an empty
 * body. A56: failure THROWS → the content KEEPS THE CONFIRM MODAL OPEN + shows saveError.
 */
export function useJournalEntryAction() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { type: "post" | "reverse"; id: string }) => {
      const endpoint =
        vars.type === "post"
          ? financeUrls.journalEntryPost(vars.id)
          : financeUrls.journalEntryReverse(vars.id);
      const res = await api.post(endpoint, {});
      if (res.error) throw new Error(res.error);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: financeKeys.scope("journal-entries"),
      }),
  });
}
