"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { webhooksKeys, fetchWebhooks } from "../api/webhooks-api";

/**
 * Webhook-subscriptions list server state (E27-S5, A79). Replaces the god-page's
 * manual `useState` + `refreshList()`: the list is keyed, and create/update/toggle/
 * delete mutations invalidate it. The queryFn throws on `result.error` so the
 * content component surfaces the error banner. `enabled` mirrors the god-page's
 * `isAuthenticated && isAdmin && accessToken` gate EXACTLY (S1: fires even while
 * auth is still loading).
 */
export function useWebhooks(enabled: boolean) {
  const api = useApiClient();
  return useQuery({
    queryKey: webhooksKeys.list(),
    queryFn: async () => {
      const result = await fetchWebhooks(api);
      if (result.error) throw new Error(result.error);
      return result.data ?? [];
    },
    enabled,
  });
}
