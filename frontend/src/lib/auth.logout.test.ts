// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * REQ-088 AC-5 (E16-S2 AC-10): regression guard for the two-effect logout flow.
 *
 * `logout()` in [lib/auth.ts:133-144](./auth.ts) must call NextAuth `signOut` with
 * a `callbackUrl` that redirects the browser to the Keycloak end-session endpoint
 * `${NEXT_PUBLIC_KEYCLOAK_ISSUER}/protocol/openid-connect/logout?redirect_uri=<origin>`.
 * Without this, the NextAuth cookie clears but the Keycloak SSO session stays alive —
 * a silent failure of "logout terminates session on both client and Keycloak side".
 *
 * The test patches `next-auth/react` so `signOut` becomes a Vitest mock without
 * triggering an actual sign-out attempt, then asserts the call payload.
 */

// Mock signOut BEFORE the SUT module imports it. vi.hoisted() makes the mock
// instance available to both this file and the mock factory.
const signOutMock = vi.hoisted(() => vi.fn());
vi.mock("next-auth/react", () => ({
  signOut: signOutMock,
  // The SUT imports useSession + signIn at module scope too; provide no-op stubs.
  useSession: vi.fn(() => ({ data: null, status: "unauthenticated" })),
  signIn: vi.fn(),
}));

describe("logout()", () => {
  let originalIssuer: string | undefined;

  beforeEach(() => {
    signOutMock.mockReset();
    // Snapshot the current env var so tests don't bleed.
    originalIssuer = process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER;
    // Pin a deterministic window.location.origin. JSDOM lets us redefine it via
    // history.pushState on the same origin; for cross-origin we substitute via
    // Object.defineProperty.
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, origin: "https://web.example.com" },
    });
  });

  afterEach(() => {
    if (originalIssuer === undefined) {
      delete process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER;
    } else {
      process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER = originalIssuer;
    }
  });

  it("calls signOut with the Keycloak end-session callbackUrl and current origin", async () => {
    process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER =
      "https://keycloak.example.com/realms/iabconnect";

    const { logout } = await import("./auth");
    await logout();

    expect(signOutMock).toHaveBeenCalledTimes(1);
    const callArg = signOutMock.mock.calls[0][0] as { callbackUrl: string };
    expect(callArg.callbackUrl).toBe(
      "https://keycloak.example.com/realms/iabconnect/protocol/openid-connect/logout" +
        "?redirect_uri=https%3A%2F%2Fweb.example.com"
    );
  });

  it("falls back to localhost issuer when NEXT_PUBLIC_KEYCLOAK_ISSUER is unset", async () => {
    delete process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER;

    // Re-import the module to pick up the env-var change. vi.resetModules
    // before each import ensures the SUT re-reads process.env at module load.
    vi.resetModules();
    const { logout } = await import("./auth");
    await logout();

    expect(signOutMock).toHaveBeenCalledTimes(1);
    const callArg = signOutMock.mock.calls[0][0] as { callbackUrl: string };
    // Matches the `?? "http://localhost:8080/realms/iabconnect"` fallback at
    // auth.ts:135 — the dev default that keeps local logout working when no
    // env file exists.
    expect(callArg.callbackUrl).toBe(
      "http://localhost:8080/realms/iabconnect/protocol/openid-connect/logout" +
        "?redirect_uri=https%3A%2F%2Fweb.example.com"
    );
  });

  it("url-encodes the redirect_uri so cross-origin chars cannot break the URL", async () => {
    process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER =
      "https://kc.example.com/realms/iabconnect";
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, origin: "https://web.example.com:8443" },
    });

    vi.resetModules();
    const { logout } = await import("./auth");
    await logout();

    const callArg = signOutMock.mock.calls[0][0] as { callbackUrl: string };
    expect(callArg.callbackUrl).toContain(
      "redirect_uri=https%3A%2F%2Fweb.example.com%3A8443"
    );
  });
});
