"use client";

import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { revokeSessionRequest } from "../api/admin-users-api";

export interface RevokeSessionVariables {
  userId: string;
  sessionId: string;
}

/**
 * Revoke a specific Keycloak session for a user (admin-only). On success the
 * `user-sessions` component removes the row locally + shows a 4s success banner;
 * on failure the row is preserved and an error banner shows (A79 — `confirm`
 * flow preserved as-is). The initial sessions LOAD + the refresh button keep the
 * god-page's one-shot/manual fetch semantics (not a TanStack query) to preserve
 * the S1-pinned behaviour, so only the revoke is a mutation here.
 */
export function useRevokeSession() {
  const { accessToken } = useAuth();
  return useMutation<void, Error, RevokeSessionVariables>({
    mutationFn: ({ userId, sessionId }) =>
      revokeSessionRequest(accessToken ?? "", userId, sessionId),
  });
}
