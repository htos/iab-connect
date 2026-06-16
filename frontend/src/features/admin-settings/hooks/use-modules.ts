"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { useAppSettings } from "@/components/providers/AppSettingsProvider";
import {
  adminSettingsKeys,
  getModules,
  updateModule,
} from "../api/admin-settings-api";

/**
 * Module-settings list query (E27-S3, A79). The god-page loaded
 * `/api/v1/module-settings` exactly once on mount (the S1 net pins "one GET per
 * mount, no duplicate"); a single TanStack query keyed on `adminSettingsKeys.modules`
 * gives that for free. The no-spinner-reflash nuance is preserved by the content
 * reading `isLoading` (true only on the FIRST fetch with no cached data) — a
 * refetch-after-save keeps the rows mounted while `isFetching` flips.
 */
export function useModules(enabled: boolean) {
  const api = useApiClient();
  return useQuery({
    queryKey: adminSettingsKeys.modules,
    queryFn: async () => {
      const result = await getModules(api);
      if (result.error || !result.data)
        throw new Error(result.error ?? "Error");
      return result.data;
    },
    enabled,
  });
}

/**
 * Module enable/disable mutation (E27-S3, A79). PUTs `/module-settings/{key}`
 * `{ enabled }`, throws on `result.error` so the content keeps the confirm modal open
 * and surfaces `moduleSaveError` where the user is acting (god-page parity). On
 * success it invalidates `adminSettingsKeys.modules` (refetch, replacing the manual
 * `loadModules()`) AND calls `refreshAppSettings()` so the sidebar / module-gating in
 * `AppSettingsProvider` does not go stale.
 */
export function useUpdateModule() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { refresh: refreshAppSettings } = useAppSettings();
  return useMutation({
    mutationFn: async (vars: { moduleKey: string; enabled: boolean }) => {
      const result = await updateModule(api, vars.moduleKey, vars.enabled);
      if (result.error) throw new Error(result.error);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: adminSettingsKeys.modules,
      });
      refreshAppSettings();
    },
  });
}
