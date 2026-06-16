import { afterEach, describe, expect, it, vi } from "vitest";
import { getMySessions, revokeMySession } from "./identity-sessions";

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
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
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
