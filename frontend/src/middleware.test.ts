import { afterEach, describe, expect, it, vi } from "vitest";

// REQ-087 (E10-S4): the direct-URL route guard. Runs in the default node env. Each test
// re-imports the module via vi.resetModules() so the in-memory settings cache starts empty.
describe("middleware", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function loadMiddleware(modules: Record<string, boolean>) {
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
});
