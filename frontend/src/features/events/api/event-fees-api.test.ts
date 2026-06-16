import { describe, expect, it, vi } from "vitest";
import {
  createEventFeeCategory,
  deactivateEventFeeCategory,
  getEventFeeCategories,
  updateEventFeeCategory,
} from "./event-fees-api";
import type { useApiClient } from "@/lib/auth";

/**
 * E24-S3: the fee-category sub-domain api owns the four fee-category URLs (no raw
 * `/api/v1/...` in components). These assert each function hits the right verb +
 * the byte-identical URL/body the `events` fns used today —
 * including the preserved trailing slash on the collection routes and the
 * POST-with-`{}` soft-retire (deactivate) endpoint.
 */

type ApiClient = ReturnType<typeof useApiClient>;

function makeApi() {
  return {
    get: vi.fn(() => Promise.resolve({ data: null, error: null, status: 200 })),
    post: vi.fn(() =>
      Promise.resolve({ data: null, error: null, status: 200 })
    ),
    put: vi.fn(() => Promise.resolve({ data: null, error: null, status: 200 })),
    delete: vi.fn(() =>
      Promise.resolve({ data: null, error: null, status: 200 })
    ),
    upload: vi.fn(),
  } as unknown as ApiClient & {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
}

describe("event-fees-api endpoint URLs + bodies", () => {
  it("getEventFeeCategories -> GET /api/v1/events/{id}/fee-categories/", () => {
    const api = makeApi();
    getEventFeeCategories(api, "evt-1");
    expect(api.get).toHaveBeenCalledWith(
      "/api/v1/events/evt-1/fee-categories/"
    );
  });

  it("createEventFeeCategory -> POST /api/v1/events/{id}/fee-categories/ with body", () => {
    const api = makeApi();
    const body = { name: "Child", amount: 10, currency: "CHF" } as never;
    createEventFeeCategory(api, "evt-1", body);
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/events/evt-1/fee-categories/",
      body
    );
  });

  it("updateEventFeeCategory -> PUT /api/v1/events/{id}/fee-categories/{catId} with body", () => {
    const api = makeApi();
    const body = { name: "Child", amount: 10, currency: "CHF" } as never;
    updateEventFeeCategory(api, "evt-1", "cat-1", body);
    expect(api.put).toHaveBeenCalledWith(
      "/api/v1/events/evt-1/fee-categories/cat-1",
      body
    );
  });

  it("deactivateEventFeeCategory -> POST /api/v1/events/{id}/fee-categories/{catId}/deactivate with {}", () => {
    const api = makeApi();
    deactivateEventFeeCategory(api, "evt-1", "cat-1");
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/events/evt-1/fee-categories/cat-1/deactivate",
      {}
    );
  });
});
