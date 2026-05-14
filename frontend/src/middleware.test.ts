import { afterEach, describe, expect, it, vi } from "vitest";

// REQ-087 (E10-S4): the direct-URL route guard. Runs in the default node env. Each test
// re-imports the module via vi.resetModules() so the in-memory settings cache starts empty.
describe("middleware", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function loadMiddlewareRaw(modules: unknown) {
    vi.resetModules();
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

  async function loadMiddleware(modules: Record<string, boolean>) {
    return loadMiddlewareRaw(modules);
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
    const { middleware, NextRequest } = await loadMiddleware({
      public_view: false,
    });

    const response = await middleware(
      new NextRequest(new URL("http://localhost:3000/"), {
        headers: { cookie: "next-auth.session-token=abc123" },
      })
    );

    // `/` is dual-purpose — an authenticated user still gets their dashboard.
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
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

  // REQ-087 (E10-S4 review patch): session-cookie detection must match the chunked,
  // __Secure-/__Host- prefixed, and Auth.js v5 variants — not just the two v4 names.
  it.each([
    "next-auth.session-token.0=chunk",
    "__Secure-next-auth.session-token=abc",
    "__Host-next-auth.session-token=abc",
    "authjs.session-token=abc",
    "__Secure-authjs.session-token.1=chunk",
  ])(
    "treats '%s' as an authenticated session and leaves / alone with public_view off",
    async (cookie) => {
      const { middleware, NextRequest } = await loadMiddleware({
        public_view: false,
      });

      const response = await middleware(
        new NextRequest(new URL("http://localhost:3000/"), {
          headers: { cookie },
        })
      );

      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    }
  );

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
