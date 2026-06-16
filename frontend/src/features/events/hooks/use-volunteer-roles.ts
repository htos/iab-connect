"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { eventsKeys } from "../api/events-api";
import { getEventVolunteerRoles } from "../api/event-volunteers-api";

/**
 * Server state for an event's volunteer ROLES (E24-S3). Keyed under
 * `eventsKeys.volunteerRoles(id)`. `enabled` mirrors the god-page's auth/role
 * gate so no fetch fires before the user is authenticated AND can manage. The
 * query error (not data) is surfaced separately so the component can reproduce
 * the god-page's "loadFailed banner but still render whatever loaded" outcome
 * (we DON'T `throw` on error — we return `{ data, error }` so a failed roles
 * load doesn't blank a successful shifts load).
 */
export function useVolunteerRoles(eventId: string, enabled: boolean) {
  const api = useApiClient();
  return useQuery({
    queryKey: eventsKeys.volunteerRoles(eventId),
    queryFn: async () => {
      const result = await getEventVolunteerRoles(api, eventId);
      return { data: result.data ?? [], error: result.error };
    },
    enabled,
  });
}
