"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { eventsKeys, updateEvent } from "../api/events-api";
import type { UpdateEventRequest } from "../types/events.types";

/**
 * Update mutation for an event (form sub-recipe, E24-S2). Throws on API error so
 * the form banner shows `mutation.error.message`; invalidates the events root
 * (list + statistics) and this event's detail on success.
 */
export function useUpdateEvent(id: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateEventRequest) => {
      const result = await updateEvent(api, id, body);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventsKeys.all });
      queryClient.invalidateQueries({ queryKey: eventsKeys.detail(id) });
    },
  });
}
