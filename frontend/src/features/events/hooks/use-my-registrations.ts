"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { eventsKeys } from "../api/events-api";
import { getMyRegistrations } from "../api/event-registrations-api";

/**
 * Current user's registrations across all events (E24-S3): the detail page's
 * member registration section reads this to find the user's registration for the
 * current event. `enabled` mirrors the page's auth gate.
 */
export function useMyRegistrations(enabled: boolean) {
  const api = useApiClient();
  return useQuery({
    queryKey: eventsKeys.myRegistrations(),
    queryFn: async () => {
      const result = await getMyRegistrations(api);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    enabled,
  });
}
