"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { eventsKeys } from "../api/events-api";
import { getEventRegistrationStatistics } from "../api/event-registrations-api";

/**
 * Registration statistics server-state (E24-S3): the 7 stat cards on the
 * registrations page + the detail page's stats summary. `enabled` mirrors the
 * page's auth gate.
 */
export function useEventRegistrationStatistics(
  eventId: string,
  enabled: boolean
) {
  const api = useApiClient();
  return useQuery({
    queryKey: eventsKeys.registrationStatistics(eventId),
    queryFn: async () => {
      const result = await getEventRegistrationStatistics(api, eventId);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    enabled,
  });
}
