"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { createSegment, segmentKeys } from "../api/member-segments-api";
import type {
  CreateSegmentRequest,
  MemberSegmentDto,
} from "../types/member-segment.types";

/**
 * Create a segment. Throws on API error so the content surfaces it in the banner
 * (god-page parity). Invalidates the list root on success.
 */
export function useCreateSegment() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<MemberSegmentDto, Error, CreateSegmentRequest>({
    mutationFn: async (body) => {
      const result = await createSegment(api, body);
      if (result.error) throw new Error(result.error);
      return result.data!;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: segmentKeys.all }),
  });
}
