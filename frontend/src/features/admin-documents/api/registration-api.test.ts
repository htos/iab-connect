import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * E27-S6: the registration slice api WRAPS the public `@/lib/api/registration`
 * raw-fetch fn (DEC-2=A). These assert the base + that the wrapper delegates the
 * body verbatim and PROPAGATES the thrown Error (A89 — the service throws on a
 * non-OK response; the wrapper does not swallow it).
 */

const serviceSpy = vi.hoisted(() => ({
  registerUser: vi.fn(),
}));
vi.mock("@/lib/api/registration", () => ({
  registerUser: serviceSpy.registerUser,
}));

import { REGISTRATION_BASE, registerUser } from "./registration-api";

afterEach(() => {
  vi.clearAllMocks();
});

const body = {
  email: "ada@example.com",
  password: "password123",
  firstName: "Ada",
  lastName: "Lovelace",
};

describe("registration api", () => {
  it("exposes the byte-identical /api/v1 base", () => {
    expect(REGISTRATION_BASE).toBe("/api/v1/registration");
  });

  it("delegates the body verbatim + returns the resolved response", async () => {
    serviceSpy.registerUser.mockResolvedValue({ success: true, message: "ok" });
    const res = await registerUser(body);
    expect(serviceSpy.registerUser).toHaveBeenCalledWith(body);
    expect(res).toEqual({ success: true, message: "ok" });
  });

  it("propagates a thrown service Error (A89 — not swallowed)", async () => {
    serviceSpy.registerUser.mockRejectedValue(
      new Error("A user with that email already exists")
    );
    await expect(registerUser(body)).rejects.toThrow("already exists");
  });
});
