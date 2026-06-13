"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { receivablesKeys, receivablesUrls } from "../api/receivables-api";
import type { Receipt } from "../types/receivables.types";

/** Receipts list. `enabled` = canReadFinance. Throws on res.error → content loadError. */
export function useReceipts(enabled: boolean) {
  const api = useApiClient();
  return useQuery<Receipt[]>({
    queryKey: receivablesKeys.receipts(),
    enabled,
    retry: false,
    queryFn: async () => {
      const res = await api.get<{ items: Receipt[] }>(
        receivablesUrls.receipts()
      );
      if (res.error) throw new Error(res.error);
      const body = res.data as { items?: Receipt[] } | null;
      return body?.items ?? [];
    },
  });
}

/**
 * Upload a receipt (FormData file + notes). The god-page `handleUpload` does NOT inspect
 * res.error (only catches throws), so this does not throw on res.error — it invalidates
 * on completion and the content closes the modal from onSuccess (A92).
 */
export function useUploadReceipt() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { file: File; notes: string }) => {
      const formData = new FormData();
      formData.append("file", vars.file);
      formData.append("notes", vars.notes);
      await api.upload(receivablesUrls.receipts(), formData);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: receivablesKeys.receipts() }),
  });
}

/** Delete a receipt (modal confirm). god-page awaits DELETE then reloads. */
export function useDeleteReceipt() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(receivablesUrls.receipt(id));
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: receivablesKeys.receipts() }),
  });
}
