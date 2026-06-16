"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { createEvent, eventsKeys } from "../api/events-api";
import type { CreateEventRequest } from "../types/events.types";

/**
 * Create mutation for an event (form sub-recipe, E24-S2). Throws on API error so
 * the form banner shows `mutation.error.message`; invalidates the events root
 * (list + statistics) on success. Returns the created `EventDto` so the caller
 * can navigate to `/events/{id}`.
 */
export function useCreateEvent() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateEventRequest) => {
      const result = await createEvent(api, body);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: eventsKeys.all }),
  });
}
