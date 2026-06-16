"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { eventsKeys } from "../api/events-api";
import { getEventWaitlist } from "../api/event-registrations-api";

/**
 * Event waitlist server-state (E24-S3): the detail page's waitlist table.
 * `enabled` mirrors that page's gate (manager + registrationRequired +
 * waitlistEnabled), so no fetch fires when the section is hidden.
 */
export function useEventWaitlist(eventId: string, enabled: boolean) {
  const api = useApiClient();
  return useQuery({
    queryKey: eventsKeys.waitlist(eventId),
    queryFn: async () => {
      const result = await getEventWaitlist(api, eventId);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    enabled,
  });
}
