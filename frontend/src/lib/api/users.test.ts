import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getMySessions,
  getUserSessions,
  resetUserMfa,
  revokeMySession,
  revokeUserSession,
} from "./users";

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

describe("getMySessions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls /api/v1/identity/sessions with bearer token and returns parsed sessions", async () => {
    const payload = {
      sessions: [
        {
          id: "session-1",
          ipAddress: "10.0.0.1",
          start: "2026-05-12T10:00:00Z",
          lastAccess: "2026-05-12T10:05:00Z",
          clients: ["iabconnect-frontend"],
        },
      ],
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    const result = await getMySessions("access-token");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:5000/api/v1/identity/sessions",
      {
        headers: { Authorization: "Bearer access-token" },
      }
    );
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0].id).toBe("session-1");
    expect(result.sessions[0].clients).toEqual(["iabconnect-frontend"]);
  });
});

describe("getUserSessions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls the admin sessions endpoint with the given userId", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
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

describe("revokeMySession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends DELETE to /identity/sessions/{id} with bearer token", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await revokeMySession("access-token", "session-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:5000/api/v1/identity/sessions/session-1",
      {
        method: "DELETE",
        headers: { Authorization: "Bearer access-token" },
      }
    );
  });

  it("throws 'Session not found' on 404", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 404 })
    );

    await expect(revokeMySession("access-token", "missing")).rejects.toThrow(
      "Session not found"
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
