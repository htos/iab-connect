// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy } from "../lib/config/security-headers";

/**
 * REQ-088 AC-4 (E14-S2): asserts the CSP helper's structural correctness — every
 * required directive is present and the NEXT_PUBLIC_* origin substitutions actually
 * happen (no leftover ${...} literals).
 *
 * Note: this is a pure-Node test (`@vitest-environment node`) — no DOM, no React,
 * no Testing-Library `render()` call. Per project-context A46 refinement, the
 * `afterEach(cleanup)` from A35 does NOT apply here.
 */
describe("buildContentSecurityPolicy", () => {
  it("returns a CSP string with all required directives", () => {
    const csp = buildContentSecurityPolicy({
      NEXT_PUBLIC_API_URL: "https://api.example.com",
      NEXT_PUBLIC_KEYCLOAK_URL: "https://kc.example.com",
      NEXT_PUBLIC_DOCUMENT_HOST: "files.example.com",
    });

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("img-src 'self' data: blob: files.example.com");
    expect(csp).toContain("font-src 'self' data:");
    expect(csp).toContain(
      "connect-src 'self' https://api.example.com https://kc.example.com",
    );
    expect(csp).toContain("frame-src https://kc.example.com");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self' https://kc.example.com");
  });

  it("falls back to localhost defaults when env vars are missing", () => {
    const csp = buildContentSecurityPolicy({});

    expect(csp).toContain(
      "connect-src 'self' http://localhost:5000 http://localhost:8080",
    );
    expect(csp).toContain("img-src 'self' data: blob: localhost:9000");
  });

  it("never emits unsubstituted ${NEXT_PUBLIC_*} placeholders", () => {
    const csp = buildContentSecurityPolicy({
      NEXT_PUBLIC_API_URL: "https://api.example.com",
      NEXT_PUBLIC_KEYCLOAK_URL: "https://kc.example.com",
    });

    expect(csp).not.toMatch(/\$\{[A-Z_]+\}/);
  });

  it("locks frame-ancestors to 'none' (clickjacking defense complements X-Frame-Options: DENY)", () => {
    const csp = buildContentSecurityPolicy({});
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("rejects directive-injection via env var (Edge-11 hardening)", () => {
    // Malicious env var that would otherwise inject a new CSP directive.
    const csp = buildContentSecurityPolicy({
      NEXT_PUBLIC_API_URL: "https://api.example.com; script-src https://evil.com",
      NEXT_PUBLIC_KEYCLOAK_URL: "https://kc.example.com",
    });

    // The injection must be rejected — we either fall back to the default or refuse.
    expect(csp).not.toContain("evil.com");
    expect(csp).not.toContain("script-src https://evil.com");
    // Default fallback must be in effect since the input contained a CSP separator.
    expect(csp).toContain("connect-src 'self' http://localhost:5000 https://kc.example.com");
  });

  it("strips path/query from origin env vars (Edge-15 hardening)", () => {
    const csp = buildContentSecurityPolicy({
      NEXT_PUBLIC_API_URL: "https://api.example.com/v1/",
      NEXT_PUBLIC_KEYCLOAK_URL: "https://kc.example.com/realms/iab?x=1",
    });

    // CSP `connect-src` carries origins only — no paths.
    expect(csp).toContain("connect-src 'self' https://api.example.com https://kc.example.com");
    expect(csp).not.toContain("/v1/");
    expect(csp).not.toContain("/realms/iab");
  });
});
