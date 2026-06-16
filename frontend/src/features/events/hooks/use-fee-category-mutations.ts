"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { eventsKeys } from "../api/events-api";
import {
  createEventFeeCategory,
  deactivateEventFeeCategory,
  updateEventFeeCategory,
} from "../api/event-fees-api";
import type { SaveFeeCategoryRequest } from "../types/events.types";

/**
 * Fee-category mutations (E24-S3): create / update / deactivate. Each invalidates
 * `eventsKeys.fees(eventId)` on success so the list refetches — preserving the
 * god-page's `refreshKey++` reload after a save/deactivate. The mutationFn throws
 * on API error so the caller surfaces the `saveFailed` banner (god-page error
 * behaviour: the dialog reads `res.error ?? saveFailed`, the deactivate handler
 * sets `saveFailed`).
 */
export function useFeeCategoryMutations(eventId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: eventsKeys.fees(eventId) });

  const create = useMutation({
    mutationFn: async (body: SaveFeeCategoryRequest) => {
      const result = await createEventFeeCategory(api, eventId, body);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({
      categoryId,
      body,
    }: {
      categoryId: string;
      body: SaveFeeCategoryRequest;
    }) => {
      const result = await updateEventFeeCategory(
        api,
        eventId,
        categoryId,
        body
      );
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: invalidate,
  });

  const deactivate = useMutation({
    mutationFn: async (categoryId: string) => {
      const result = await deactivateEventFeeCategory(api, eventId, categoryId);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: invalidate,
  });

  return { create, update, deactivate };
}
