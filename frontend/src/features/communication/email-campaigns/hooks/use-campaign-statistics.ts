"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import {
  emailCampaignsKeys,
  getCampaignStatistics,
} from "../api/email-campaigns-api";

/**
 * Campaign statistics server state (E25-S3, A79). On the god-page this was a
 * branch of the parallel load: the stats fetch could fail silently (the page only
 * set `statistics` when `statsRes.ok`). Here it is its own query that returns
 * `null` on any error/empty response — so the statistics grid renders only when
 * data is present, matching the god-page. `enabled` mirrors the detail query gate.
 */
export function useCampaignStatistics(id: string, enabled: boolean) {
  const api = useApiClient();
  return useQuery({
    queryKey: emailCampaignsKeys.statistics(id),
    queryFn: async () => {
      const result = await getCampaignStatistics(api, id);
      if (result.error || !result.data) return null;
      return result.data;
    },
    enabled: enabled && !!id,
  });
}
