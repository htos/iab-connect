"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { fetchHealthDetail, healthKeys } from "../api/health-api";
import type { HealthDetailResponse } from "../types/health.types";

/**
 * System-health server state (E27-S4, DEC-3 = A). `refetchInterval: 30_000`
 * REPLACES the god-page's `setInterval(fetchHealth, 30000)` — TanStack polls every
 * 30s while the query is enabled (mounted + admin + token), preserving the exact
 * 30s cadence (the S1 health net's fake-timer test advances virtual time by 30s
 * and expects one additional fetch). `refetchOnWindowFocus: false` keeps the
 * cadence purely interval-driven (the god-page had no focus refetch). `retry:
 * false` mirrors the god-page (error on the first failed fetch). `enabled` mirrors
 * the page's `isAuthenticated && isAdmin && accessToken` gate.
 */
export function useHealth(enabled: boolean) {
  const { accessToken } = useAuth();
  return useQuery<HealthDetailResponse>({
    queryKey: healthKeys.detail(),
    queryFn: () => fetchHealthDetail(accessToken ?? ""),
    enabled: enabled && !!accessToken,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
