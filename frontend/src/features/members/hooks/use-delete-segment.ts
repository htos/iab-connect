"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { deleteSegment, segmentKeys } from "../api/member-segments-api";

/**
 * Delete a segment. Throws on API error so the caller surfaces it (list: error
 * banner + stay; detail: stay on page). Invalidates the list root on success
 * (the list refetches; the detail caller redirects instead).
 */
export function useDeleteSegment() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteSegment(api, id);
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: segmentKeys.all }),
  });
}
