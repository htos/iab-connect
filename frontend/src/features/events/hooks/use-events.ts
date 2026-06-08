"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import {
  eventsKeys,
  fetchEvents,
  type ListEventsFilters,
} from "../api/events-api";

/**
 * Server state for the events list (E24-S2). The god-page does SERVER-side
 * search/status/category filtering, so all filters are part of the query key and
 * TanStack refetches as any change. `enabled` mirrors the page's auth gate so no
 * fetch fires before the user is authenticated.
 */
export function useEvents(filters: ListEventsFilters, enabled: boolean) {
  const api = useApiClient();
  return useQuery({
    queryKey: eventsKeys.list(filters),
    queryFn: async () => {
      const result = await fetchEvents(api, filters);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    enabled,
  });
}
