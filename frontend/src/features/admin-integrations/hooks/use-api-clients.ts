"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { apiClientsKeys, fetchApiClients } from "../api/api-clients-api";

/**
 * Api-clients list server state (E27-S5, A79). Replaces the god-page's manual
 * `useState` + `refreshClients()` refetch: the list is keyed, and a create/revoke
 * mutation's `invalidateQueries({ queryKey: apiClientsKeys.list() })` does the
 * refetch. The queryFn throws on `result.error` so the component surfaces the error
 * banner (god-page parity). `enabled` mirrors the god-page's
 * `isAuthenticated && isAdmin && accessToken` gate EXACTLY (A97/S1: the fetch fires
 * even while auth is still loading, because the gate never included `authLoading`).
 */
export function useApiClients(enabled: boolean) {
  const api = useApiClient();
  return useQuery({
    queryKey: apiClientsKeys.list(),
    queryFn: async () => {
      const result = await fetchApiClients(api);
      if (result.error) throw new Error(result.error);
      return result.data ?? [];
    },
    enabled,
  });
}
