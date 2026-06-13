"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { webhooksKeys, updateWebhook } from "../api/webhooks-api";
import type { WebhookRequest } from "../types/admin-integrations.types";

/**
 * Update-webhook mutation (E27-S5, A79). PUT `${BASE}/{id}` — NEVER returns or shows
 * a secret (the show-once signing-secret panel is create-only). Throws on API error
 * so the dialog surfaces the error banner (god-page's `setError(res.error)`). On
 * success invalidates the list. A95: the body's `eventTypes` is whatever the caller
 * passes (the stored selection, round-tripped verbatim even when out of
 * availableEventTypes) — this hook does not touch it.
 */
export function useUpdateWebhook() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: WebhookRequest }) => {
      const result = await updateWebhook(api, id, body);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: webhooksKeys.list() }),
  });
}
