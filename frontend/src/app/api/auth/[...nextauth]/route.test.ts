import { describe, expect, it, vi } from "vitest";

// E30-S3 auth-route smoke: proves `NextAuth(authOptions)` constructs without throwing
// and exports GET + POST handlers — catching a broken provider/callback/session config
// at test time. Does NOT invoke the handler against the network/Keycloak.

// Provide dummy Keycloak env BEFORE the route module evaluates (authOptions reads these
// at module-init via `process.env.KEYCLOAK_*!`). vi.hoisted runs before the import below.
vi.hoisted(() => {
  process.env.KEYCLOAK_CLIENT_ID ??= "test-client";
  process.env.KEYCLOAK_CLIENT_SECRET ??= "test-secret";
  process.env.KEYCLOAK_ISSUER ??= "https://keycloak.test/realms/test";
});

import { GET, POST } from "./route";

describe("NextAuth route handler (smoke — E30-S3)", () => {
  it("constructs GET and POST handlers from NextAuth(authOptions)", () => {
    expect(typeof GET).toBe("function");
    expect(typeof POST).toBe("function");
  });
});
