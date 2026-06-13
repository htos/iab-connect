// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPublicBlogPost,
  getPublicBlogPosts,
  getPublicEvent,
  getPublicEventFeeCategories,
  getPublicEvents,
  getPublicSponsors,
  registerForEventPublic,
} from "./public-content-api";

/**
 * E28-S2: focused builder tests for the public content slice transport — the URL,
 * method, and payload shape of each server-fetch fn (byte-identical to the former
 * inline page fetches). Plain Node env (no jsdom) — only `fetch` is stubbed.
 */

function stubFetch(
  impl: (url: string, init?: RequestInit) => Partial<Response>
) {
  const mock = vi.fn(
    async (url: string | URL | Request, init?: RequestInit) =>
      impl(String(url), init) as Response
  );
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("public-content-api builders", () => {
  it("getPublicBlogPosts → GET /api/v1/blog/public", async () => {
    const fetchMock = stubFetch(() => ({ ok: true, json: async () => [] }));
    await getPublicBlogPosts();
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/v1/blog/public");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
  });

  it("getPublicBlogPost(id) → GET /api/v1/blog/public/{id}", async () => {
    const fetchMock = stubFetch(() => ({ ok: true, json: async () => ({}) }));
    await getPublicBlogPost("abc");
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/api/v1/blog/public/abc"
    );
  });

  it("getPublicEvents → GET /api/v1/events/public", async () => {
    const fetchMock = stubFetch(() => ({ ok: true, json: async () => [] }));
    await getPublicEvents();
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/api/v1/events/public"
    );
  });

  it("getPublicEvent(id) → GET /api/v1/events/public/{id}", async () => {
    const fetchMock = stubFetch(() => ({ ok: true, json: async () => ({}) }));
    await getPublicEvent("e1");
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/api/v1/events/public/e1"
    );
  });

  it("getJson throws HTTP <status> on a non-2xx response", async () => {
    stubFetch(() => ({ ok: false, status: 503, json: async () => ({}) }));
    await expect(getPublicEvents()).rejects.toThrow("HTTP 503");
  });

  it("getPublicEventFeeCategories(id) → GET /{id}/fee-categories, returns the list", async () => {
    const fetchMock = stubFetch(() => ({
      ok: true,
      json: async () => [
        { id: "f1", name: "Adult", amount: 25, currency: "CHF" },
      ],
    }));
    const fees = await getPublicEventFeeCategories("e1");
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/api/v1/events/public/e1/fee-categories"
    );
    expect(fees).toHaveLength(1);
  });

  it("getPublicEventFeeCategories is best-effort: returns [] on a non-2xx response", async () => {
    stubFetch(() => ({ ok: false, status: 404, json: async () => ({}) }));
    await expect(getPublicEventFeeCategories("e1")).resolves.toEqual([]);
  });

  it("getPublicSponsors → GET /api/v1/sponsors/public", async () => {
    const fetchMock = stubFetch(() => ({ ok: true, json: async () => [] }));
    await getPublicSponsors();
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/api/v1/sponsors/public"
    );
  });

  it("registerForEventPublic → POST /api/v1/events/{id}/registrations/public with the payload", async () => {
    const fetchMock = stubFetch(() => ({
      ok: true,
      json: async () => ({ isWaitlisted: false }),
    }));
    await registerForEventPublic("e1", {
      name: "John",
      email: "john@example.com",
      numberOfGuests: 2,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/events/e1/registrations/public");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "John",
      email: "john@example.com",
      numberOfGuests: 2,
    });
  });

  it("registerForEventPublic throws the raw error body on failure", async () => {
    stubFetch(() => ({
      ok: false,
      status: 400,
      text: async () => "Event is full",
    }));
    await expect(
      registerForEventPublic("e1", {
        name: "x",
        email: "x@y.z",
        numberOfGuests: 1,
      })
    ).rejects.toThrow("Event is full");
  });
});
