"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  emailTemplatesKeys,
  fetchEmailTemplates,
} from "../api/email-templates-api";

/**
 * Email-templates list server state (E25-S4, A79). The god-page fetched all
 * templates once (no server-side filter) and searched client-side; here the list
 * key is flat and a mutation's `invalidateQueries({ queryKey:
 * emailTemplatesKeys.all })` replaces the manual `setTemplates`/`filter` refetch.
 *
 * The god-page LIST had NO redirect guard — it read only `useAuth().accessToken`,
 * started `loading=true`, and its load effect early-returned (never clearing
 * `loading`) when the token was missing, leaving the spinner stuck. To preserve
 * that EXACTLY, `enabled` is gated ONLY on `!!accessToken` (no role check), and the
 * content component shows the spinner while the token has not arrived. The token
 * comes from `useAuth().accessToken`.
 */
export function useEmailTemplates() {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: emailTemplatesKeys.list(),
    queryFn: () => fetchEmailTemplates(accessToken ?? ""),
    enabled: !!accessToken,
  });
}
