import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * E27-S2: focused unit pins for the admin-users transport wrapper.
 *
 * - `adminUsersKeys` SHAPE: the load-bearing invariant is that `roles()` is a
 *   DISTINCT key from `detail(id)` (they hit different URLs:
 *   `/api/v1/users/roles` vs `/api/v1/users/{id}`) so caches never collide; and
 *   that `list` carries search+page so a search/page change refetches.
 * - The WRAP delegates to the lib token-param fns with BYTE-IDENTICAL args
 *   (A94) — including the create path that preserves the 409 message — so the
 *   E27-S1 transport mocks keep intercepting.
 * - `rolesChanged` Set-diff drives the two-step edit save's conditional second
 *   call.
 */

// Mock the lib transport so we can assert delegation without real fetch.
// `vi.hoisted` so the spy object exists before the hoisted `vi.mock` factory runs.
const lib = vi.hoisted(() => ({
  getUsers: vi.fn(),
  getUser: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  setUserEnabled: vi.fn(),
  sendPasswordReset: vi.fn(),
  resetUserMfa: vi.fn(),
  updateUserRoles: vi.fn(),
  getAvailableRoles: vi.fn(),
  getUserSessions: vi.fn(),
  revokeUserSession: vi.fn(),
}));
vi.mock("@/features/admin-users/api/users-admin", () => lib);

import {
  ADMIN_USERS_PAGE_SIZE,
  adminUsersKeys,
  createUserRequest,
  deleteUserRequest,
  fetchAvailableRoles,
  fetchUser,
  fetchUserSessions,
  listUsers,
  resetMfaRequest,
  resetPasswordRequest,
  revokeSessionRequest,
  rolesChanged,
  setEnabledRequest,
  updateRolesRequest,
  updateUserRequest,
} from "./admin-users-api";

beforeEach(() => {
  for (const fn of Object.values(lib)) fn.mockReset();
});
afterEach(() => vi.clearAllMocks());

describe("adminUsersKeys", () => {
  it("uses a DISTINCT key for roles() vs detail(id) so the caches never collide", () => {
    expect(adminUsersKeys.roles()).toEqual(["admin-users", "roles"]);
    expect(adminUsersKeys.detail("abc")).toEqual([
      "admin-users",
      "detail",
      "abc",
    ]);
    expect(adminUsersKeys.roles()).not.toEqual(adminUsersKeys.detail("roles"));
  });

  it("carries search + page in the list key so either change refetches", () => {
    expect(adminUsersKeys.list("anna", 2)).toEqual([
      "admin-users",
      "list",
      { search: "anna", page: 2 },
    ]);
    expect(adminUsersKeys.list("anna", 2)).not.toEqual(
      adminUsersKeys.list("anna", 3)
    );
  });

  it("keys sessions per user under the admin-users root", () => {
    expect(adminUsersKeys.sessions("u1")).toEqual([
      "admin-users",
      "sessions",
      "u1",
    ]);
    expect(adminUsersKeys.all).toEqual(["admin-users"]);
  });
});

describe("listUsers", () => {
  it("delegates to getUsers with pageSize 20 and an omitted (undefined) empty search", () => {
    lib.getUsers.mockResolvedValue({ users: [], totalCount: 0 });
    listUsers("tok", { page: 1, search: "" });
    expect(lib.getUsers).toHaveBeenCalledWith("tok", {
      search: undefined,
      page: 1,
      pageSize: 20,
    });
    expect(ADMIN_USERS_PAGE_SIZE).toBe(20);
  });

  it("passes a non-empty search term through verbatim", () => {
    lib.getUsers.mockResolvedValue({ users: [], totalCount: 0 });
    listUsers("tok", { page: 3, search: "anna" });
    expect(lib.getUsers).toHaveBeenCalledWith("tok", {
      search: "anna",
      page: 3,
      pageSize: 20,
    });
  });
});

describe("query wrappers delegate byte-identically", () => {
  it("fetchUser → getUser(token,id); fetchAvailableRoles → getAvailableRoles(token)", () => {
    fetchUser("tok", "u1");
    expect(lib.getUser).toHaveBeenCalledWith("tok", "u1");
    fetchAvailableRoles("tok");
    expect(lib.getAvailableRoles).toHaveBeenCalledWith("tok");
  });

  it("fetchUserSessions → getUserSessions(token,id)", () => {
    fetchUserSessions("tok", "u1");
    expect(lib.getUserSessions).toHaveBeenCalledWith("tok", "u1");
  });
});

describe("mutation wrappers delegate byte-identically", () => {
  it("createUserRequest delegates to createUser and propagates the 409 message", async () => {
    lib.createUser.mockRejectedValue(
      new Error("A user with this email already exists")
    );
    await expect(
      createUserRequest("tok", { email: "dupe@x.example" })
    ).rejects.toThrow("A user with this email already exists");
    expect(lib.createUser).toHaveBeenCalledWith("tok", {
      email: "dupe@x.example",
    });
  });

  it("updateUserRequest / updateRolesRequest delegate with their args", () => {
    updateUserRequest("tok", "u1", { email: "x@y.example" });
    expect(lib.updateUser).toHaveBeenCalledWith("tok", "u1", {
      email: "x@y.example",
    });
    updateRolesRequest("tok", "u1", ["admin", "member"]);
    expect(lib.updateUserRoles).toHaveBeenCalledWith("tok", "u1", [
      "admin",
      "member",
    ]);
  });

  it("setEnabled / resetPassword / resetMfa / delete / revoke delegate", () => {
    setEnabledRequest("tok", "u1", false);
    expect(lib.setUserEnabled).toHaveBeenCalledWith("tok", "u1", false);
    resetPasswordRequest("tok", "u1");
    expect(lib.sendPasswordReset).toHaveBeenCalledWith("tok", "u1");
    resetMfaRequest("tok", "u1");
    expect(lib.resetUserMfa).toHaveBeenCalledWith("tok", "u1");
    deleteUserRequest("tok", "u1");
    expect(lib.deleteUser).toHaveBeenCalledWith("tok", "u1");
    revokeSessionRequest("tok", "u1", "s1");
    expect(lib.revokeUserSession).toHaveBeenCalledWith("tok", "u1", "s1");
  });
});

describe("rolesChanged (Set-diff that gates the two-step save)", () => {
  it("is false for identical sets (order-independent)", () => {
    expect(rolesChanged(["a", "b"], ["b", "a"])).toBe(false);
  });
  it("is true when an element is added", () => {
    expect(rolesChanged(["member"], ["member", "admin"])).toBe(true);
  });
  it("is true when an element is removed", () => {
    expect(rolesChanged(["member", "admin"], ["member"])).toBe(true);
  });
  it("is true when an element is swapped (same size, different members)", () => {
    expect(rolesChanged(["a"], ["b"])).toBe(true);
  });
});
