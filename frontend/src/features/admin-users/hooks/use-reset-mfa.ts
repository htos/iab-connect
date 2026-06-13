"use client";

import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { resetMfaRequest } from "../api/admin-users-api";

/**
 * Reset a user's MFA credentials. No cache to invalidate; the content shows a
 * success `alert` and surfaces any error in the banner (A79 — `confirm`/`alert`
 * preserved as-is).
 */
export function useResetMfa() {
  const { accessToken } = useAuth();
  return useMutation<void, Error, string>({
    mutationFn: (userId) => resetMfaRequest(accessToken ?? "", userId),
  });
}
