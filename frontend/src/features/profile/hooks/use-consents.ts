"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { fetchConsents, profileKeys } from "../api/profile-api";

/**
 * Consent preferences (E29-S4, DEC-4=A). Wraps `privacy.getConsents`
 * (token-based). `enabled` mirrors the page gate.
 *
 * A76 BRANCH 1 (silent load failure): the god-page swallowed a `getConsents`
 * failure in an empty catch and surfaced NOTHING. We preserve that by NEVER
 * rendering this query's error — the consumer reads `data ?? []` only and shows
 * no error banner for a load failure. (A bare empty list is the same observable
 * outcome the god-page produced.)
 */
export function useConsents(enabled: boolean) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: profileKeys.consents(),
    queryFn: () => fetchConsents(accessToken as string),
    enabled: enabled && !!accessToken,
  });
}
