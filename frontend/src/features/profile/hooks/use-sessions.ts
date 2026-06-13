"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { fetchMySessions, profileKeys } from "../api/profile-api";
import type { UserSession } from "../types/profile.types";

/**
 * Active Keycloak sessions for the caller (E29-S4, REQ-010). Wraps
 * `users.getMySessions` (token-based). `enabled` mirrors the security
 * page's `isAuthenticated` guard (no member check). Selects the `sessions` array
 * so consumers get `UserSession[]` directly.
 *
 * A76: a load failure surfaces — UNLIKE consent. The S1 security net pins that
 * HEAD shows an ALERT banner on a `getMySessions` rejection (and the list stays
 * empty), so this query's error IS surfaced by `profile-security-content.tsx`
 * while the row list reads `data ?? []` (empty on error).
 */
export function useSessions(enabled: boolean) {
  const { accessToken } = useAuth();
  return useQuery<UserSession[]>({
    queryKey: profileKeys.sessions(),
    queryFn: async () => {
      const result = await fetchMySessions(accessToken as string);
      return result.sessions;
    },
    enabled: enabled && !!accessToken,
  });
}
