"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { financeKeys, financeUrls } from "../api/finance-api";
import type {
  CreatePostingMappingRequest,
  PostingMapping,
} from "../types/finance.types";

/**
 * Posting-mappings list. Tolerant of array OR `{ items }`. `enabled` gated on
 * `modeChecked && canReadFinance` (A97) — the DoubleEntry mode guard runs in the content.
 */
export function usePostingMappings(enabled: boolean) {
  const api = useApiClient();
  return useQuery<PostingMapping[]>({
    queryKey: financeKeys.postingMappings(),
    enabled,
    queryFn: async () => {
      const res = await api.get(financeUrls.postingMappings());
      if (res.error) throw new Error(res.error);
      const data = res.data;
      return Array.isArray(data)
        ? (data as PostingMapping[])
        : ((data as { items?: PostingMapping[] })?.items ?? []);
    },
  });
}

/**
 * Create/update a posting mapping. A56 SILENT-SWALLOW: the god-page `handleSave` does
 * NOT inspect `res.error` (closes modal + refetches regardless). Create POSTs the full
 * form; edit PUTs ONLY `{ ledgerAccountId, taxLedgerAccountId }`.
 */
export function useSavePostingMapping() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string | null;
      createBody?: CreatePostingMappingRequest;
      editBody?: {
        ledgerAccountId: string;
        taxLedgerAccountId: string | null;
      };
    }) => {
      if (vars.id) {
        await api.put(financeUrls.postingMapping(vars.id), vars.editBody);
      } else {
        await api.post(financeUrls.postingMappings(), vars.createBody);
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: financeKeys.postingMappings(),
      }),
  });
}

/** Delete a posting mapping. A56 SILENT-SWALLOW (god-page ignores res.error). */
export function useDeletePostingMapping() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(financeUrls.postingMapping(id));
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: financeKeys.postingMappings(),
      }),
  });
}
