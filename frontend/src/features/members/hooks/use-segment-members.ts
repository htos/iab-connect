"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { fetchSegmentMembers, segmentKeys } from "../api/member-segments-api";

/**
 * Paged members of a segment. Keyed under the segment detail so an add/remove
 * mutation's `invalidateQueries({ queryKey: segmentKeys.detail(id) })` refetches
 * the member list (preserving the god-page's `refreshKey`-driven reload).
 */
export function useSegmentMembers(id: string, page: number, enabled: boolean) {
  const api = useApiClient();
  return useQuery({
    queryKey: segmentKeys.members(id, page),
    queryFn: async () => {
      const result = await fetchSegmentMembers(api, id, page);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    enabled: enabled && !!id,
  });
}
