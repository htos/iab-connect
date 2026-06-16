"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { apiClientsKeys, revokeApiClient } from "../api/api-clients-api";

/**
 * Revoke-api-client mutation (E27-S5, A79). Throws on API error so the content
 * component surfaces the error banner (god-page's `setError(res.error)`). On success
 * invalidates the list so the refetch reflects the now-revoked row (god-page's
 * `void refreshClients()`). The `window.confirm` gate stays in the component
 * (DEC-3 = A) — this hook is only the transport + invalidation.
 */
export function useRevokeApiClient() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await revokeApiClient(api, id);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: apiClientsKeys.list() }),
  });
}
