"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  automationsKeys,
  fetchAutomations,
  type ListAutomationsFilters,
} from "../api/automations-api";

/**
 * Server state for the automations list (E25-S2). Mirrors the god-page's
 * `accessToken && (isVorstand || isAdmin)` gate via `enabled` so no fetch fires
 * for unauthorized users. The server-side `status` filter + `page` are part of
 * the query key (TanStack refetches on change); client-side search stays in the
 * component. The token comes from `useAuth().accessToken`.
 */
export function useAutomations(
  filters: ListAutomationsFilters,
  enabled: boolean
) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: automationsKeys.list(filters),
    queryFn: () => fetchAutomations(accessToken ?? "", filters),
    enabled: enabled && !!accessToken,
  });
}
