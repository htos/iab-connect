"use client";

import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { resetPasswordRequest } from "../api/admin-users-api";

/**
 * Send a password-reset email for a user. No cache to invalidate (no list/detail
 * state changes); the content shows a success `alert` and surfaces any error in
 * the banner (A79 — the god-page `confirm`/`alert` flow is preserved as-is).
 */
export function useResetPassword() {
  const { accessToken } = useAuth();
  return useMutation<void, Error, string>({
    mutationFn: (userId) => resetPasswordRequest(accessToken ?? "", userId),
  });
}
