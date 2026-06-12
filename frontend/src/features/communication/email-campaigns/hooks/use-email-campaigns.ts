"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import {
  emailCampaignsKeys,
  fetchEmailCampaigns,
  type ListEmailCampaignsFilters,
} from "../api/email-campaigns-api";

/**
 * Email-campaigns list server state (E25-S3, A79). The god-page did SERVER-side
 * `status` filtering + pagination and a manual `fetchCampaigns()` refetch; here
 * the filters are part of the list key so TanStack refetches on any page/status
 * change, and a mutation's `invalidateQueries({ queryKey: emailCampaignsKeys.all })`
 * replaces the manual refetch. The queryFn throws on `result.error` so the
 * component surfaces the `loadError` banner (god-page parity); `enabled` mirrors
 * the page's `accessToken && (isVorstand || isAdmin)` gate so no GET fires for
 * unauthorised users.
 */
export function useEmailCampaigns(
  filters: ListEmailCampaignsFilters,
  enabled: boolean
) {
  const api = useApiClient();
  return useQuery({
    queryKey: emailCampaignsKeys.list(filters),
    queryFn: async () => {
      const result = await fetchEmailCampaigns(api, filters);
      if (result.error || !result.data)
        throw new Error(result.error ?? "Error");
      return result.data;
    },
    enabled,
  });
}
