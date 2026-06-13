"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { fetchStatistics, membersKeys } from "../api/members-api";

/**
 * Members statistics card data. The god-page treated statistics as OPTIONAL — a
 * fetch failure was swallowed and the cards simply did not render (never an
 * error banner). Preserved here by returning `null` on error instead of
 * throwing, so the component gates the cards on truthy data. Keyed under the
 * `all` root so a delete's `invalidateQueries({ queryKey: membersKeys.all })`
 * refetches it alongside the list.
 */
export function useMemberStatistics(enabled: boolean) {
  const api = useApiClient();
  return useQuery({
    queryKey: membersKeys.statistics(),
    queryFn: async () => {
      const result = await fetchStatistics(api);
      if (result.error) return null;
      return result.data;
    },
    enabled,
  });
}
