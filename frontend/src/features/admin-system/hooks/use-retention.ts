"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { fetchRetentionPolicies, retentionKeys } from "../api/retention-api";
import type { RetentionPolicyDto } from "../types/retention.types";

/**
 * Retention-policies list server state (E27-S4). No server-side filter, so a flat
 * list key. `retry: false` mirrors the god-page. `enabled` mirrors the page's
 * `isAuthenticated && isAdmin && accessToken` gate.
 */
export function useRetention(enabled: boolean) {
  const { accessToken } = useAuth();
  return useQuery<RetentionPolicyDto[]>({
    queryKey: retentionKeys.list(),
    queryFn: () => fetchRetentionPolicies(accessToken ?? ""),
    enabled: enabled && !!accessToken,
    retry: false,
  });
}
