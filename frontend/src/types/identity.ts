/**
 * Shared Keycloak-session types (E31-S1, DEC-2). Relocated verbatim off the
 * retired `users`. Lives in `@/types` (a lib-leaf, import-legal from any
 * feature) because they are consumed by BOTH the `admin-users` slice (admin
 * session views) and the `profile` slice (the user's own sessions); a
 * feature-owned home would force a cross-feature import (E21-S5). REQ-010.
 */

/**
 * Keycloak session for a user (REQ-010).
 * Fields are best-effort — Keycloak may omit some values depending on event/session configuration.
 */
export interface UserSession {
  id: string;
  ipAddress: string | null;
  start: string | null;
  lastAccess: string | null;
  clients: string[];
}

export interface SessionListResponse {
  sessions: UserSession[];
}
