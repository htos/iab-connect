/**
 * Self-service Keycloak-session transport (E31-S1; relocated verbatim off the
 * retired `users`). The CURRENT user's own sessions (`/api/v1/identity/
 * sessions`) — distinct from the admin `getUserSessions`/`revokeUserSession`
 * (which live in `features/admin-users/api/users-admin.ts`). Shared session types
 * live in `@/types/identity` (DEC-2). REQ-010.
 */

import type { SessionListResponse } from "@/types/identity";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * Get active Keycloak sessions for the currently authenticated user (REQ-010).
 * Returns an empty list (not an error) if Keycloak has no admin record for the user.
 */
export async function getMySessions(
  accessToken: string
): Promise<SessionListResponse> {
  const response = await fetch(`${API_BASE}/api/v1/identity/sessions`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch sessions: ${response.status}`);
  }

  return response.json();
}

/**
 * Revoke one of the current user's own Keycloak sessions (REQ-010).
 * Backend verifies ownership before forwarding to Keycloak.
 */
export async function revokeMySession(
  accessToken: string,
  sessionId: string
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/api/v1/identity/sessions/${sessionId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Session not found");
    }
    throw new Error(`Failed to revoke session: ${response.status}`);
  }
}
