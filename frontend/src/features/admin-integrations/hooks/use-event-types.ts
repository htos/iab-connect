"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { webhooksKeys, fetchWebhookEventTypes } from "../api/webhooks-api";

/**
 * Available webhook event types for the dialog checkboxes (E27-S5). The god-page
 * only `setAvailableEventTypes` when `typesRes.data` was present, otherwise kept the
 * empty default — mirrored here by degrading to `[]` on error/empty (no banner for
 * an event-types failure). `enabled` matches the list gate.
 */
export function useEventTypes(enabled: boolean) {
  const api = useApiClient();
  return useQuery({
    queryKey: webhooksKeys.eventTypes(),
    queryFn: async () => {
      const result = await fetchWebhookEventTypes(api);
      return result.data ?? [];
    },
    enabled,
  });
}
