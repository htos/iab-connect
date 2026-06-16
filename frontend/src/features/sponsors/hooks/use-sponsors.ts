"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { fetchSponsors, sponsorsKeys } from "../api/sponsors-api";

/**
 * Server state for the sponsors list (mirrors the E21-S3 suppliers slice).
 * `enabled` mirrors the page's `isAuthenticated && (isVorstand || isAdmin)` gate
 * so no fetch fires for unauthorized users. The server-side `status` filter is
 * part of the query key; client-side search stays in the component.
 */
export function useSponsors(status: string, enabled: boolean) {
  const api = useApiClient();
  return useQuery({
    queryKey: sponsorsKeys.list(status),
    queryFn: async () => {
      const result = await fetchSponsors(api, status);
      if (result.error) throw new Error(result.error);
      return result.data ?? [];
    },
    enabled,
  });
}
