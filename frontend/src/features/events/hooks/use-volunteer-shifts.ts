"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { eventsKeys } from "../api/events-api";
import { getEventVolunteerShifts } from "../api/event-volunteers-api";

/**
 * Server state for an event's volunteer SHIFTS (E24-S3). Keyed under
 * `eventsKeys.volunteerShifts(id)`. As with the roles query, the API error is
 * returned alongside the data (NOT thrown) so a failed shifts load surfaces the
 * `loadFailed` banner without blanking a successful roles load — and so a
 * successful mutation's `invalidateQueries(volunteerShifts(id))` refetches the
 * roster, preserving the god-page `refreshKey` reload outcome.
 */
export function useVolunteerShifts(eventId: string, enabled: boolean) {
  const api = useApiClient();
  return useQuery({
    queryKey: eventsKeys.volunteerShifts(eventId),
    queryFn: async () => {
      const result = await getEventVolunteerShifts(api, eventId);
      return { data: result.data ?? [], error: result.error };
    },
    enabled,
  });
}
