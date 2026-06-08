"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { segmentKeys, updateSegment } from "../api/member-segments-api";
import type {
  MemberSegmentDto,
  UpdateSegmentRequest,
} from "../types/member-segment.types";

/**
 * Update a segment. Throws on API error so the content surfaces it in the banner.
 * Invalidates the list root + this segment's detail on success.
 */
export function useUpdateSegment(id: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<MemberSegmentDto, Error, UpdateSegmentRequest>({
    mutationFn: async (body) => {
      const result = await updateSegment(api, id, body);
      if (result.error) throw new Error(result.error);
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: segmentKeys.all });
      queryClient.invalidateQueries({ queryKey: segmentKeys.detail(id) });
    },
  });
}
