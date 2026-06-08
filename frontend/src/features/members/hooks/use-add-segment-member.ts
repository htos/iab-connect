"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { addSegmentMember, segmentKeys } from "../api/member-segments-api";

/**
 * Add a member to a static segment. On success invalidates the segment detail
 * (which covers both the segment query and its keyed members list), replacing
 * the god-page's `refreshKey` bump. Throws on API error so the content surfaces
 * it in the banner.
 */
export function useAddSegmentMember(id: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => {
      const result = await addSegmentMember(api, id, memberId);
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: segmentKeys.detail(id) }),
  });
}
