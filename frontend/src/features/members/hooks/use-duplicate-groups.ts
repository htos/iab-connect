"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { duplicateKeys, fetchDuplicateGroups } from "../api/members-api";

/**
 * Server state for the duplicate-groups review page. `page` + `minTier` are part
 * of the key so TanStack refetches as either changes (replacing the god-page's
 * refreshKey/queryparam dance). `enabled` mirrors the page's Vorstand/Admin gate
 * so no fetch fires for the unauthorized. Throws on API error so the caller's
 * error state surfaces it.
 */
export function useDuplicateGroups(
  page: number,
  minTier: string,
  enabled: boolean
) {
  const api = useApiClient();
  return useQuery({
    queryKey: duplicateKeys.groups(page, minTier),
    queryFn: async () => {
      const result = await fetchDuplicateGroups(api, {
        page,
        pageSize: 20,
        minTier,
      });
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    enabled,
  });
}
