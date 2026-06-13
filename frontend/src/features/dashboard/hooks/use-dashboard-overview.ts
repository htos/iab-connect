"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { dashboardKeys, fetchDashboardOverview } from "../api/dashboard-api";

/**
 * Dashboard KPI server state (E30-S4 — BUILD on useApiClient, A88/A94).
 *
 * `enabled` mirrors the god-page's FETCH gate `isAuthenticated && canViewKpis` (A97) —
 * NOT a render/role gate — so a non-privileged user reaches the same no-KPI surface,
 * not a stuck spinner. `retry: false` matches the god-page's single ungated fetch (A99;
 * the provider default `retry: 1` would double-fetch + delay). The error is surfaced as
 * the SAME string the manual loader showed (A79 — `useApiClient` returns the error
 * string in `{ error }`, re-thrown here as `Error.message`).
 */
export function useDashboardOverview(enabled: boolean) {
  const api = useApiClient();
  return useQuery({
    queryKey: dashboardKeys.overview(),
    queryFn: async () => {
      const result = await fetchDashboardOverview(api);
      if (result.error) throw new Error(result.error);
      return result.data ?? null;
    },
    enabled,
    retry: false,
  });
}
