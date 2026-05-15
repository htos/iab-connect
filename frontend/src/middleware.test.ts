import { afterEach, describe, expect, it, vi } from "vitest";

// REQ-087 (E10-S4): the direct-URL route guard. Runs in the default node env. Each test
// re-imports the module via vi.resetModules() so the in-memory settings cache starts empty.
describe("middleware", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.doUnmock("next-auth/jwt");
  });

  // Round-2 [Review][Patch] (DN-1): the middleware now validates the JWT via
  // next-auth/jwt's `getToken` instead of sniffing cookie names. Mock it per test so
  // we can simulate authenticated / anonymous without managing real signatures.
  async function loadMiddlewareRaw(
    modules: unknown,
    options: { authenticated?: boolean } = {}
  ) {
    vi.resetModules();
    vi.doMock("next-auth/jwt", () => ({
      getToken: vi
        .fn()
        .mockResolvedValue(options.authenticated ? { sub: "user-123" } : null),
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ modules }),
      })
    );
    const mod = await import("./middleware");
    const { NextRequest } = await import("next/server");
    return { middleware: mod.middleware, NextRequest };
  }

  async function loadMiddleware(
    modules: Record<string, boolean>,
    options: { authenticated?: boolean } = {}
  ) {
    return loadMiddlewareRaw(modules, options);
  }

  it("rewrites a disabled-module path to /module-unavailable", async () => {
    const { middleware, NextRequest } = await loadMiddleware({
      finance: false,
    });

    const response = await middleware(
      new NextRequest(new URL("http://localhost:3000/finance/invoices"))
    );

    expect(response.headers.get("x-middleware-rewrite")).toContain(
      "/module-unavailable"
    );
  });

  it("passes an enabled-module path straight through", async () => {
    const { middleware, NextRequest } = await loadMiddleware({ finance: true });

    const response = await middleware(
      new NextRequest(new URL("http://localhost:3000/finance/invoices"))
    );

    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("treats an unknown / missing module key as enabled (behaviour-preserving)", async () => {
    const { middleware, NextRequest } = await loadMiddleware({});

    const response = await middleware(
      new NextRequest(new URL("http://localhost:3000/members"))
    );

    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  // REQ-087 (E10-S5): the Public View gate.
  it("rewrites /public/* to /site-unavailable when public_view is disabled", async () => {
    const { middleware, NextRequest } = await loadMiddleware({
      public_view: false,
    });

    const response = await middleware(
      new NextRequest(new URL("http://localhost:3000/public/blog"))
    );

    expect(response.headers.get("x-middleware-rewrite")).toContain(
      "/site-unavailable"
    );
  });

  it("exempts /public/unsubscribe/* even when public_view is disabled (Q1)", async () => {
    const { middleware, NextRequest } = await loadMiddleware({
      public_view: false,
    });

    const response = await middleware(
      new NextRequest(
        new URL("http://localhost:3000/public/unsubscribe/some-token")
      )
    );

    // Transactional unsubscribe links must stay reachable for compliance.
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("rewrites the unauthenticated landing / when public_view is disabled", async () => {
    const { middleware, NextRequest } = await loadMiddleware({
      public_view: false,
    });

    const response = await middleware(
      new NextRequest(new URL("http://localhost:3000/"))
    );

    expect(response.headers.get("x-middleware-rewrite")).toContain(
      "/site-unavailable"
    );
  });

  it("leaves / alone for an authenticated user even when public_view is disabled", async () => {
    // Round-2 [Review][Patch] (DN-1): getToken returns a non-null decoded JWT —
    // the user is treated as authenticated, regardless of cookie name shape (which
    // next-auth/jwt handles internally).
    const { middleware, NextRequest } = await loadMiddleware(
      { public_view: false },
      { authenticated: true }
    );

    const response = await middleware(
      new NextRequest(new URL("http://localhost:3000/"))
    );

    // `/` is dual-purpose — an authenticated user still gets their dashboard.
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("rewrites / for an anonymous visitor when public_view is disabled (getToken returns null)", async () => {
    // Round-2 [Review][Patch] (DN-1): a missing or forged cookie produces null from
    // getToken, so the visitor is treated as anonymous and the rewrite applies. This
    // is the *strict* neutral-UX contract — a fabricated `authjs.session-token=anything`
    // cookie no longer bypasses the rewrite as the round-1 cookie-shape check allowed.
    const { middleware, NextRequest } = await loadMiddleware(
      { public_view: false }
      // default: authenticated: false (getToken returns null)
    );

    const response = await middleware(
      new NextRequest(new URL("http://localhost:3000/"), {
        // Even with a cookie that LOOKS like a session, getToken returns null because
        // the signature does not verify. The visitor is treated as anonymous.
        headers: { cookie: "authjs.session-token=forged-value" },
      })
    );

    expect(response.headers.get("x-middleware-rewrite")).toContain(
      "/site-unavailable"
    );
  });

  it("serves /public/* normally when public_view is enabled", async () => {
    const { middleware, NextRequest } = await loadMiddleware({
      public_view: true,
    });

    const response = await middleware(
      new NextRequest(new URL("http://localhost:3000/public/events"))
    );

    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  // Round-2 [Review][Patch] (P-S5-4): explicit-segment matching for /public and
  // /public/unsubscribe. A hyphenated similar path is NOT an unsubscribe link — it
  // must be rewritten like any other public path.
  it("rewrites /public/unsubscribe-page (not an unsubscribe route) when public_view is off", async () => {
    const { middleware, NextRequest } = await loadMiddleware({
      public_view: false,
    });

    const response = await middleware(
      new NextRequest(
        new URL("http://localhost:3000/public/unsubscribe-page")
      )
    );

    expect(response.headers.get("x-middleware-rewrite")).toContain(
      "/site-unavailable"
    );
  });

  // REQ-087 (E10-S4 review patch): a malformed `modules` field must not silently disable
  // gating — anything that is not a clean boolean map is treated as "all enabled".
  it.each([
    ["an array", ["finance"]],
    ["a string", "finance"],
    ["string-valued booleans", { finance: "false" }],
    ["null", null],
  ])(
    "treats a malformed modules payload (%s) as all-enabled",
    async (_label, malformed) => {
      const { middleware, NextRequest } = await loadMiddlewareRaw(malformed);

      const response = await middleware(
        new NextRequest(new URL("http://localhost:3000/finance/invoices"))
      );

      // Malformed shape => no gating applied; the path passes through.
      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    }
  );
});
