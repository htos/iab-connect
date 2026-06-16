"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { fetchSegment, segmentKeys } from "../api/member-segments-api";
import type { MemberSegmentDto } from "../types/member-segment.types";

/**
 * Sentinel kept for parity with the slice's `MemberNotFoundError`. NOTE: the
 * segments detail god-page rendered the SAME `segments.notFound` state for BOTH
 * a 404 (no data) AND a generic GET error (the error string was never shown — a
 * pinned E23-S1 quirk). To preserve that exactly, this hook resolves to `null`
 * for both cases rather than throwing; the sentinel is exported for callers that
 * want to distinguish, but the content treats `!segment` uniformly as not-found.
 */
export class SegmentNotFoundError extends Error {
  constructor() {
    super("segments.notFound");
    this.name = "SegmentNotFoundError";
  }
}

export function useSegment(id: string, enabled: boolean) {
  const api = useApiClient();
  return useQuery<MemberSegmentDto | null>({
    queryKey: segmentKeys.detail(id),
    queryFn: async () => {
      const result = await fetchSegment(api, id);
      // QUIRK (E23-S1): both a 404 and a generic error fall through to the
      // not-found state — the error string is never surfaced on first load.
      if (result.error || !result.data) return null;
      return result.data;
    },
    enabled: enabled && !!id,
  });
}
