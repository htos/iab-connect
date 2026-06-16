"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { removeSegmentMember, segmentKeys } from "../api/member-segments-api";

/**
 * Remove a member from a static segment. On success invalidates the segment
 * detail (covering the segment query + its keyed members list), replacing the
 * god-page's `refreshKey` bump. Throws on API error so the content surfaces it.
 */
export function useRemoveSegmentMember(id: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => {
      const result = await removeSegmentMember(api, id, memberId);
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: segmentKeys.detail(id) }),
  });
}
