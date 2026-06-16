"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { fetchSegments, segmentKeys } from "../api/member-segments-api";
import type { ListSegmentsArgs } from "../api/member-segments-api";

/**
 * Server state for the Member Segments list. search/type/active/page are all
 * part of the key, so TanStack refetches as any changes — preserving the
 * god-page's filter-driven refetch (replacing the manual `refreshKey`). `enabled`
 * mirrors the page's Vorstand/Admin gate so no fetch fires for the unauthorized.
 */
export function useSegments(args: ListSegmentsArgs, enabled: boolean) {
  const api = useApiClient();
  return useQuery({
    queryKey: segmentKeys.list(args.search, args.type, args.active, args.page),
    queryFn: async () => {
      const result = await fetchSegments(api, args);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    enabled,
  });
}
