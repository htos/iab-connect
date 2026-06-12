"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { receivablesKeys, receivablesUrls } from "../api/receivables-api";
import type { DunningForm, DunningNotice } from "../types/receivables.types";

/** Dunning notices list. `enabled` = canReadFinance. Throws on res.error → loadError. */
export function useDunning(enabled: boolean) {
  const api = useApiClient();
  return useQuery<DunningNotice[]>({
    queryKey: receivablesKeys.dunning(),
    enabled,
    retry: false,
    queryFn: async () => {
      const res = await api.get<{ items: DunningNotice[] }>(
        receivablesUrls.dunning()
      );
      if (res.error) throw new Error(res.error);
      const body = res.data as { items?: DunningNotice[] } | null;
      return body?.items ?? [];
    },
  });
}

/**
 * Create a dunning notice (modal). god-page `handleSave` does NOT inspect res.error (only
 * catches throws), so this does not throw on res.error — the content closes the modal from
 * onSuccess (A92) and the query is invalidated.
 */
export function useCreateDunning() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (form: DunningForm) => {
      await api.post(receivablesUrls.dunning(), form);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: receivablesKeys.dunning() }),
  });
}

/** Send a dunning notice (Draft rows, orange affordance). god-page awaits then refetches. */
export function useSendDunning() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.post(receivablesUrls.dunningSend(id), {});
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: receivablesKeys.dunning() }),
  });
}
