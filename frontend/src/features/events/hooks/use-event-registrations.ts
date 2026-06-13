"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { eventsKeys } from "../api/events-api";
import {
  getEventRegistrations,
  type RegistrationListParams,
} from "../api/event-registrations-api";

/**
 * Manager registrations list server-state (E24-S3). The god-page does
 * SERVER-side status/search filtering with pageSize=20 paging, so every filter
 * is part of the query key and TanStack refetches as any changes. `enabled`
 * mirrors the page's auth gate so no fetch fires before authentication.
 */
export function useEventRegistrations(
  eventId: string,
  filters: RegistrationListParams,
  enabled: boolean
) {
  const api = useApiClient();
  return useQuery({
    queryKey: eventsKeys.registrations(eventId, filters),
    queryFn: async () => {
      const result = await getEventRegistrations(api, eventId, filters);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    enabled,
  });
}
