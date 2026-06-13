"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { adminSettingsKeys, getSettings } from "../api/admin-settings-api";

/**
 * Branding settings query (E27-S3, A79). The god-page loaded `/api/v1/settings`
 * once on mount (gated on `isAuthenticated && isAdmin`); the query `enabled` mirrors
 * that gate so no GET fires for an unauthorised render. The queryFn throws on
 * `result.error` so the content surfaces the persistent `loadError` banner (god-page
 * parity). A mutation invalidates `adminSettingsKeys.settings` to refetch.
 */
export function useSettings(enabled: boolean) {
  const api = useApiClient();
  return useQuery({
    queryKey: adminSettingsKeys.settings,
    queryFn: async () => {
      const result = await getSettings(api);
      if (result.error || !result.data)
        throw new Error(result.error ?? "Error");
      return result.data;
    },
    enabled,
  });
}
