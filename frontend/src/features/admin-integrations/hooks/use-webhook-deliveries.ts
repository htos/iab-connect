"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import {
  webhookDeliveriesKeys,
  fetchWebhookDeliveries,
} from "../api/webhook-deliveries-api";

/**
 * Webhook-deliveries paged server state (E27-S5, A79). The `page` is part of the key
 * so TanStack refetches on prev/next (replacing the god-page's manual `page` effect).
 * The queryFn throws on `result.error` so the content component surfaces the error
 * banner. `enabled` mirrors the god-page's `isAuthenticated && isAdmin && accessToken`
 * gate. Metadata-only / read-only: no filters, no retry (AC-2).
 */
export function useWebhookDeliveries(page: number, enabled: boolean) {
  const api = useApiClient();
  return useQuery({
    queryKey: webhookDeliveriesKeys.list(page),
    queryFn: async () => {
      const result = await fetchWebhookDeliveries(api, page);
      if (result.error) throw new Error(result.error);
      return result.data ?? null;
    },
    enabled,
  });
}
