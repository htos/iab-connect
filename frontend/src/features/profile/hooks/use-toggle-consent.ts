"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { toggleConsent, profileKeys } from "../api/profile-api";

interface ToggleConsentVars {
  consentType: string;
  currentlyGranted: boolean;
}

/**
 * Toggle a consent (E29-S4, DEC-4=A). Wraps `grant`/`revokeConsent`; throws on
 * their error so the mutation enters `isError` (A76 BRANCH 3 — the explicit
 * error message, NO auto-dismiss timer). On success it invalidates
 * `profileKeys.consents` (the god-page's refetch) so the checkbox reflects the
 * new state; the component then shows the success message that auto-dismisses
 * after 3000 ms (A76 BRANCH 2 — driven by a local effect keyed on `isSuccess`
 * in `consent-preferences.tsx`, mirroring HEAD; the timer coexists with the
 * mutation state without TanStack owning the toast).
 */
export function useToggleConsent() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ consentType, currentlyGranted }: ToggleConsentVars) =>
      toggleConsent(accessToken as string, consentType, currentlyGranted),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: profileKeys.consents() }),
  });
}
