"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { revokeMySession, profileKeys } from "../api/profile-api";
import type { UserSession } from "../types/profile.types";

/**
 * Revoke one of the caller's own sessions (E29-S4, REQ-010 — the ONLY mutating
 * action on the security page; no device-change action exists, AC-4).
 *
 * A76/A79 OPTIMISTIC removal: the god-page removed the revoked row from local
 * state immediately on success (before the network settled, in the same tick).
 * We preserve the optimistic feel with `onMutate` → `setQueryData` removing the
 * row from `profileKeys.sessions` BEFORE the request resolves, and roll back via
 * the snapshot in `onError` (so the error path re-shows the row — the S1 net
 * pins "error → row NOT removed"). A naive invalidate-on-success would re-show
 * the row until the refetch completed (an A79 delta we explicitly avoid). We do
 * NOT invalidate on success — the optimistic state IS the truth (matching HEAD,
 * which never refetched after a revoke).
 */
export function useRevokeSession() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      revokeMySession(accessToken as string, sessionId),
    onMutate: async (sessionId: string) => {
      await queryClient.cancelQueries({ queryKey: profileKeys.sessions() });
      const previous = queryClient.getQueryData<UserSession[]>(
        profileKeys.sessions()
      );
      queryClient.setQueryData<UserSession[]>(
        profileKeys.sessions(),
        (current) => (current ?? []).filter((s) => s.id !== sessionId)
      );
      return { previous };
    },
    onError: (_err, _sessionId, context) => {
      // Roll back the optimistic removal so the row re-appears (error path).
      if (context?.previous !== undefined) {
        queryClient.setQueryData(profileKeys.sessions(), context.previous);
      }
    },
  });
}
