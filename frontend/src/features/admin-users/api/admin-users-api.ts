// Admin-users feature API — the slice's single transport surface (E27-S2,
// DEC-1 = A). It WRAPS the token-param raw-fetch functions in `@/lib/api/users`
// (A94) rather than re-implementing the `/api/v1/users` URLs via `useApiClient`.
//
// Why WRAP and not rewrite:
//   - The lib module already owns the URLs/params/bodies AND the status-derived
//     string sentinels the S1 net pins: the create 409 → "A user with this
//     email already exists" and the 404 → "User not found". Re-routing through
//     `useApiClient` would surface a different ProblemDetails `detail` and break
//     those assertions.
//   - The lib module is also consumed by the self-service profile security page
//     (`getMySessions`/`revokeMySession`), so it must stay; orphaning it via a
//     rewrite is not an option.
//   - Wrapping keeps the E27-S1 transport mocks (`vi.mock("@/lib/api/users")`)
//     intercepting unchanged, so the regression net survives by construction.
//
// No raw `/api/v1/...` string appears in this slice's components — every URL is
// owned by the lib module these thin wrappers delegate to.
import {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  setUserEnabled,
  sendPasswordReset,
  resetUserMfa,
  updateUserRoles,
  getAvailableRoles,
  getUserSessions,
  revokeUserSession,
} from "@/lib/api/users";
import type {
  User,
  UserListResponse,
  CreateUserRequest,
  UpdateUserRequest,
  Role,
  SessionListResponse,
} from "../types/admin-user.types";

/**
 * Query-key + invalidation convention (E21-S1 server-state strategy). Server-side
 * search/page are part of the `list` key so TanStack refetches as either changes,
 * preserving the god-page's server-side search/pagination. `roles` is a DISTINCT
 * key from `detail(id)`: `getAvailableRoles` hits `/api/v1/users/roles` while
 * `getUser` hits `/api/v1/users/{id}` — were `roles` keyed as `detail("roles")`
 * the two would collide. `sessions(id)` keys the per-user Keycloak session list.
 */
export const adminUsersKeys = {
  all: ["admin-users"] as const,
  list: (search: string, page: number) =>
    ["admin-users", "list", { search, page }] as const,
  detail: (id: string) => ["admin-users", "detail", id] as const,
  roles: () => ["admin-users", "roles"] as const,
  sessions: (id: string) => ["admin-users", "sessions", id] as const,
};

// Fixed page size — preserves the god-page's `pageSize=20` (the S1 net pins this
// exact value in the `getUsers(token, { page, pageSize: 20 })` call shape).
export const ADMIN_USERS_PAGE_SIZE = 20;

export interface ListUsersArgs {
  page: number;
  search: string;
}

// --- Queries (WRAP the lib token-param fns; args byte-identical) ---

export function listUsers(
  accessToken: string,
  { page, search }: ListUsersArgs
): Promise<UserListResponse> {
  // `search || undefined` mirrors the god-page: an empty search omits the param.
  return getUsers(accessToken, {
    search: search || undefined,
    page,
    pageSize: ADMIN_USERS_PAGE_SIZE,
  });
}

export function fetchUser(accessToken: string, userId: string): Promise<User> {
  return getUser(accessToken, userId);
}

export function fetchAvailableRoles(accessToken: string): Promise<Role[]> {
  return getAvailableRoles(accessToken);
}

export function fetchUserSessions(
  accessToken: string,
  userId: string
): Promise<SessionListResponse> {
  return getUserSessions(accessToken, userId);
}

// --- Mutations (WRAP the lib token-param fns) ---

export function createUserRequest(
  accessToken: string,
  body: CreateUserRequest
): Promise<User> {
  // Keeps the create 409 → "A user with this email already exists" message
  // (status-derived inside the lib fn) the S1 net surfaces verbatim.
  return createUser(accessToken, body);
}

export function updateUserRequest(
  accessToken: string,
  userId: string,
  body: UpdateUserRequest
): Promise<User> {
  return updateUser(accessToken, userId, body);
}

export function updateRolesRequest(
  accessToken: string,
  userId: string,
  roles: string[]
): Promise<string[]> {
  return updateUserRoles(accessToken, userId, roles);
}

export function setEnabledRequest(
  accessToken: string,
  userId: string,
  enabled: boolean
): Promise<User> {
  return setUserEnabled(accessToken, userId, enabled);
}

export function resetPasswordRequest(
  accessToken: string,
  userId: string
): Promise<void> {
  return sendPasswordReset(accessToken, userId);
}

export function resetMfaRequest(
  accessToken: string,
  userId: string
): Promise<void> {
  return resetUserMfa(accessToken, userId);
}

export function deleteUserRequest(
  accessToken: string,
  userId: string
): Promise<void> {
  return deleteUser(accessToken, userId);
}

export function revokeSessionRequest(
  accessToken: string,
  userId: string,
  sessionId: string
): Promise<void> {
  return revokeUserSession(accessToken, userId, sessionId);
}

/**
 * Pure helper: has the role set changed? Mirrors the god-page edit's Set-diff
 * (`currentRoles.size !== newRoles.size || some current not in new`) that gates
 * the conditional second `updateUserRoles` call in the two-step save. Extracted
 * so it can be unit-pinned independently of React.
 */
export function rolesChanged(current: string[], next: string[]): boolean {
  const currentRoles = new Set(current);
  const newRoles = new Set(next);
  return (
    currentRoles.size !== newRoles.size ||
    [...currentRoles].some((r) => !newRoles.has(r))
  );
}
