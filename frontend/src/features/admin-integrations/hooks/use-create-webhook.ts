"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { webhooksKeys, createWebhook } from "../api/webhooks-api";
import type {
  WebhookRequest,
  WebhookSubscriptionCreatedDto,
} from "../types/admin-integrations.types";

/**
 * Create-webhook mutation (E27-S5, A79). Throws on API error (or a missing data
 * body) so the dialog surfaces the error banner (god-page's
 * `setError(res.error ?? t("saveFailed"))`). On success RETURNS the created DTO —
 * the ONLY shape carrying the one-time cleartext signing secret — so the content
 * component stores it in local `createdSecret` panel state, shown ONLY on create
 * (the edit/PUT path never produces a secret). Invalidates the list.
 */
export function useCreateWebhook() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      body: WebhookRequest
    ): Promise<WebhookSubscriptionCreatedDto> => {
      const result = await createWebhook(api, body);
      if (result.error || !result.data) throw new Error(result.error ?? "");
      return result.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: webhooksKeys.list() }),
  });
}
