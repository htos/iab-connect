"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import {
  cancelEvent,
  deleteEvent,
  eventsKeys,
  publishEvent,
  unpublishEvent,
} from "../api/events-api";
import type { EventDto } from "../types/events.types";

/**
 * Detail-page mutations (E24-S2): publish / unpublish / cancel / delete. The
 * publish/unpublish/cancel endpoints each return the updated `EventDto`; on
 * success we write it straight into the detail query cache via `setQueryData`
 * (and invalidate the list/statistics root via `eventsKeys.all`) — preserving
 * the god-page's "the mutation response updates the view, no extra GET"
 * semantics. Delete has no body to write back: it invalidates the root so the
 * list refetches; the component navigates to `/events` on success. Each
 * mutation throws on API error so the caller can surface the error banner (the
 * god-page error behaviour).
 */
export function useEventDetailMutations(id: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();

  const writeDetail = (data: EventDto | null) => {
    if (data) queryClient.setQueryData(eventsKeys.detail(id), data);
    queryClient.invalidateQueries({ queryKey: eventsKeys.all });
  };

  const publish = useMutation({
    mutationFn: async () => {
      const result = await publishEvent(api, id);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: writeDetail,
  });

  const unpublish = useMutation({
    mutationFn: async () => {
      const result = await unpublishEvent(api, id);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: writeDetail,
  });

  const cancel = useMutation({
    mutationFn: async (reason?: string) => {
      const result = await cancelEvent(api, id, reason);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: writeDetail,
  });

  const remove = useMutation({
    mutationFn: async () => {
      const result = await deleteEvent(api, id);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: eventsKeys.all }),
  });

  return { publish, unpublish, cancel, remove };
}

/**
 * Thin single-purpose wrappers around `useEventDetailMutations`, mirroring the
 * suppliers detail-mutations surface the story asks for (each owns its own
 * invalidation through the shared hook). Components may use either the grouped
 * hook above or these focused hooks.
 */
export function usePublishEvent(id: string) {
  return useEventDetailMutations(id).publish;
}

export function useUnpublishEvent(id: string) {
  return useEventDetailMutations(id).unpublish;
}

export function useCancelEvent(id: string) {
  return useEventDetailMutations(id).cancel;
}

export function useDeleteEvent(id: string) {
  return useEventDetailMutations(id).remove;
}
