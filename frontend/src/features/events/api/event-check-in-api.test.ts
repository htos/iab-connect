import { describe, expect, it, vi } from "vitest";
import {
  checkInByQrCode,
  getCheckInRoster,
  manualCheckIn,
} from "./event-check-in-api";
import type { useApiClient } from "@/lib/auth";

/**
 * E24-S3: the check-in sub-domain api owns the three check-in URLs (no raw
 * `/api/v1/...` in components). These assert each fn hits the right verb + the
 * byte-identical URL/body the `@/lib/services/events` fns used — most critically
 * the QR-token `encodeURIComponent` and the manual `searchQuery ?? null` body.
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
  };
}

describe("getCheckInRoster", () => {
  it("GETs the bare roster URL (includeWaitlisted:false → no query string)", () => {
    const api = makeApi();
    getCheckInRoster(api, "evt-1");
    expect(api.get).toHaveBeenCalledWith(
      "/api/v1/events/evt-1/registrations/check-in-roster"
    );
  });
});

describe("checkInByQrCode", () => {
  it("POSTs the QR route with an empty body", () => {
    const api = makeApi();
    checkInByQrCode(api, "evt-1", "tok-anna");
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/registrations/check-in/tok-anna",
      {}
    );
  });

  it("URL-encodes a token containing reserved characters", () => {
    const api = makeApi();
    checkInByQrCode(api, "evt-1", "a/b c?d#e");
    expect(api.post).toHaveBeenCalledWith(
      `/api/v1/registrations/check-in/${encodeURIComponent("a/b c?d#e")}`,
      {}
    );
  });
});

describe("manualCheckIn", () => {
  it("POSTs the manual-check-in URL with searchQuery=null when omitted", () => {
    const api = makeApi();
    manualCheckIn(api, "evt-1", "reg-anna");
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/events/evt-1/registrations/reg-anna/manual-check-in",
      { searchQuery: null }
    );
  });

  it("forwards a provided searchQuery in the body", () => {
    const api = makeApi();
    manualCheckIn(api, "evt-1", "reg-anna", "anna");
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/events/evt-1/registrations/reg-anna/manual-check-in",
      { searchQuery: "anna" }
    );
  });
});
