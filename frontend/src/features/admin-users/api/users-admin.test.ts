import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getUserSessions,
  resetUserMfa,
  revokeUserSession,
} from "./users-admin";

describe("resetUserMfa", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts to the MFA reset endpoint with bearer token", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await resetUserMfa("access-token", "user-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:5000/api/v1/users/user-1/reset-mfa",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer access-token",
        },
      }
    );
  });

  it("throws a generic error for failed MFA reset responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("sensitive provider failure", { status: 500 })
    );

    await expect(resetUserMfa("access-token", "user-1")).rejects.toThrow(
      "Failed to reset MFA: 500"
    );
  });
});

describe("getUserSessions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls the admin sessions endpoint with the given userId", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ sessions: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await getUserSessions("access-token", "user-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:5000/api/v1/users/user-1/sessions",
      {
        headers: { Authorization: "Bearer access-token" },
      }
    );
    expect(result.sessions).toEqual([]);
  });

  it("throws 'User not found' on 404", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 404 })
    );

    await expect(getUserSessions("access-token", "missing")).rejects.toThrow(
      "User not found"
    );
  });
});

describe("revokeUserSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends DELETE to admin sessions endpoint with userId and sessionId", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await revokeUserSession("access-token", "user-1", "session-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:5000/api/v1/users/user-1/sessions/session-1",
      {
        method: "DELETE",
        headers: { Authorization: "Bearer access-token" },
      }
    );
  });

  it("throws generic error on 500", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("server error", { status: 500 })
    );

    await expect(
      revokeUserSession("access-token", "user-1", "session-1")
    ).rejects.toThrow("Failed to revoke session: 500");
  });
});
