"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { eventsKeys, fetchEventStatistics } from "../api/events-api";

/**
 * Statistics server state (E24-S2). Mirrors the god-page's optional-stats
 * behaviour: the cards only render for managers, so `enabled` carries that gate.
 * On the god-page a stats failure was silently ignored; the component decides
 * how to treat `isError` (it can simply not render the cards).
 */
export function useEventStatistics(enabled: boolean) {
  const api = useApiClient();
  return useQuery({
    queryKey: eventsKeys.statistics(),
    queryFn: async () => {
      const result = await fetchEventStatistics(api);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    enabled,
  });
}
