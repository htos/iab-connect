// Profile feature API (E29-S4). Encapsulates every endpoint the profile +
// security surface touches (E21-S1 rule 5: no raw `/api/v1/...` strings in
// components) + owns the `profileKeys` query-key factory.
//
// DEC-1 = A (transport): the self-service `/api/v1/members/me` GET/PUT migrates
// to the E21-S1 `useApiClient()` contract ({ data, error, status }, never
// throws). The consent / channel-preference (`@/lib/api/privacy`) and session
// (`@/lib/api/users`) helpers stay on their existing modules — those modules
// already centralize their URLs and are shared elsewhere, so we WRAP them here
// (bodies/URLs byte-identical) rather than re-implement them against
// `useApiClient` (the documents-slice E29-S2 precedent).
import type { useApiClient } from "@/lib/auth";
import {
  getConsents as serviceGetConsents,
  grantConsent as serviceGrantConsent,
  revokeConsent as serviceRevokeConsent,
  getChannelPreference as serviceGetChannelPreference,
  updateChannelPreference as serviceUpdateChannelPreference,
} from "@/lib/api/privacy";
import {
  getMySessions as serviceGetMySessions,
  revokeMySession as serviceRevokeMySession,
} from "@/lib/api/users";
import type {
  MemberDto,
  UpdateOwnProfileRequest,
  ConsentDto,
  ChannelPreferenceDto,
  SessionListResponse,
} from "../types/profile.types";

type ProfileApiClient = ReturnType<typeof useApiClient>;

const MEMBERS_ME = "/api/v1/members/me";

/**
 * Query-key + invalidation convention (E21-S1 server-state strategy). The four
 * profile concerns are independent caches: the member record (`me`), consent
 * preferences (`consents`), the channel preference (`channelPreference`), and
 * the active sessions (`sessions`).
 */
export const profileKeys = {
  all: ["profile"] as const,
  me: () => ["profile", "me"] as const,
  consents: () => ["profile", "consents"] as const,
  channelPreference: () => ["profile", "channelPreference"] as const,
  sessions: () => ["profile", "sessions"] as const,
};

// --- Self-service member record (DEC-1=A → useApiClient) ---

/** GET the caller's own member record (`{data,error,status}`; never throws). */
export function getMyProfile(api: ProfileApiClient) {
  return api.get<MemberDto>(MEMBERS_ME);
}

/** PUT the caller's own member record (body byte-identical to the god-page). */
export function updateMyProfile(
  api: ProfileApiClient,
  body: UpdateOwnProfileRequest
) {
  return api.put<MemberDto>(MEMBERS_ME, body);
}

// --- Consent (wrap @/lib/api/privacy; URLs/bodies byte-identical) ---

export function fetchConsents(accessToken: string): Promise<ConsentDto[]> {
  return serviceGetConsents(accessToken);
}

/** Toggle a consent: grant if not currently granted, otherwise revoke. */
export function toggleConsent(
  accessToken: string,
  consentType: string,
  currentlyGranted: boolean
): Promise<void> {
  return currentlyGranted
    ? serviceRevokeConsent(accessToken, consentType)
    : serviceGrantConsent(accessToken, consentType);
}

// --- Channel preference (wrap @/lib/api/privacy) ---

export function fetchChannelPreference(
  accessToken: string
): Promise<ChannelPreferenceDto> {
  return serviceGetChannelPreference(accessToken);
}

export function updateChannelPreference(
  accessToken: string,
  preferredChannel: string
): Promise<void> {
  return serviceUpdateChannelPreference(accessToken, preferredChannel);
}

// --- Sessions (wrap @/lib/api/users) ---

export function fetchMySessions(
  accessToken: string
): Promise<SessionListResponse> {
  return serviceGetMySessions(accessToken);
}

export function revokeMySession(
  accessToken: string,
  sessionId: string
): Promise<void> {
  return serviceRevokeMySession(accessToken, sessionId);
}
