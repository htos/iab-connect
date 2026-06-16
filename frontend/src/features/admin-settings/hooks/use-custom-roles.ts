"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { adminSettingsKeys, getCustomRoles } from "../api/admin-settings-api";

/**
 * Custom-roles list query (E27-S3, A79). The god-page loaded `/api/v1/custom-roles`
 * once on mount (gated on `isAuthenticated && isAdmin`); the query `enabled` mirrors
 * that gate. The queryFn throws on `result.error` so the content surfaces the
 * persistent `rolesLoadError` banner (god-page parity). The role mutations invalidate
 * `adminSettingsKeys.customRoles`.
 */
export function useCustomRoles(enabled: boolean) {
  const api = useApiClient();
  return useQuery({
    queryKey: adminSettingsKeys.customRoles,
    queryFn: async () => {
      const result = await getCustomRoles(api);
      if (result.error || !result.data)
        throw new Error(result.error ?? "Error");
      return result.data;
    },
    enabled,
  });
}
