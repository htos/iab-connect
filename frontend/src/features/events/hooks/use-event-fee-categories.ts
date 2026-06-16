"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { eventsKeys } from "../api/events-api";
import { getEventFeeCategories } from "../api/event-fees-api";

/**
 * Fee-category list server state (E24-S3). `enabled` mirrors the god-page's
 * data-load gate (authenticated AND can-manage) so no GET fires before the role
 * check passes — preserving the god-page behaviour where a non-manager never
 * triggered the load. On API error the queryFn throws so the component surfaces
 * the `loadFailed` banner.
 */
export function useEventFeeCategories(eventId: string, enabled: boolean) {
  const api = useApiClient();
  return useQuery({
    queryKey: eventsKeys.fees(eventId),
    queryFn: async () => {
      const result = await getEventFeeCategories(api, eventId);
      if (result.error) throw new Error(result.error);
      return result.data ?? [];
    },
    enabled: enabled && !!eventId,
  });
}
