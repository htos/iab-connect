"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { apiClientsKeys, fetchApiClientScopes } from "../api/api-clients-api";

/**
 * Available scopes for the create dialog (E27-S5). The god-page loaded these
 * alongside the list and degraded to `[]` (it only `setAvailableScopes` when
 * `scopesRes.data` was present, otherwise left the empty default). The queryFn
 * mirrors that by returning `[]` on error/empty (no banner for a scopes failure —
 * god-page parity). `enabled` matches the list gate.
 */
export function useScopes(enabled: boolean) {
  const api = useApiClient();
  return useQuery({
    queryKey: apiClientsKeys.scopes(),
    queryFn: async () => {
      const result = await fetchApiClientScopes(api);
      return result.data ?? [];
    },
    enabled,
  });
}
