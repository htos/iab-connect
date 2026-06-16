"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { getMyProfile, profileKeys } from "../api/profile-api";

/**
 * Sentinel error so the page content can render the dedicated no-member-record
 * view (admin-vs-member message + links) for a `GET /api/v1/members/me` 404 —
 * distinct from a generic load error — preserving the god-page's branch (A79).
 */
export class NoMemberRecordError extends Error {
  constructor() {
    super("profile.noMemberRecord");
    this.name = "NoMemberRecordError";
  }
}

/**
 * Self-service member record (E29-S4, DEC-1=A — `/members/me` migrated to
 * `useApiClient`). `enabled` mirrors the page's `isAuthenticated && isMember`
 * gate so no GET fires for a guest or non-member.
 *
 * Behaviour-preserving (A79): a 404 throws `NoMemberRecordError` (the no-record
 * view). Any other non-2xx threw the generic `t("error.loadingError")` on the
 * god-page (it never surfaced the raw server body for the load), so the hook
 * throws the `error.loadingError` i18n KEY — the content `t()`s the message —
 * keeping the S1 "inline error notice → error.loadingError" assertion green.
 */
export function useProfile(enabled: boolean) {
  const api = useApiClient();
  return useQuery({
    queryKey: profileKeys.me(),
    queryFn: async () => {
      const result = await getMyProfile(api);
      if (result.status === 404) throw new NoMemberRecordError();
      if (result.error || !result.data) throw new Error("error.loadingError");
      return result.data;
    },
    enabled,
    // A 404 is deterministic — skip the provider's `retry: 1` so the no-member
    // view renders immediately (god-page parity: the first 404 short-circuited
    // to the no-record view, no second fetch). Other errors keep the default.
    retry: (failureCount, error) =>
      !(error instanceof NoMemberRecordError) && failureCount < 1,
  });
}
