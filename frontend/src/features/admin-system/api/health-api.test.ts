// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * E27-S4: the health slice api owns the query-key factory and WRAPS the existing
 * `@/lib/api/health` transport (DEC-1 = A — note it hits SERVER-ROOT `/health*`,
 * NOT `/api/v1`). Asserts the key shapes + byte-identical delegation to the lib fn
 * (so the S1 net's call-count + arg assertions hold). The AC-8 `res.ok` fix lives
 * inside the lib fn (verified separately by the lib).
 */

const libSpy = vi.hoisted(() => ({ getHealthDetail: vi.fn() }));
vi.mock("@/lib/api/health", () => ({
  getHealthDetail: (...a: unknown[]) => libSpy.getHealthDetail(...a),
}));

import { healthKeys, fetchHealthDetail } from "./health-api";

afterEach(() => vi.clearAllMocks());

describe("healthKeys", () => {
  it("exposes the stable key shapes", () => {
    expect(healthKeys.all).toEqual(["health"]);
    expect(healthKeys.detail()).toEqual(["health", "detail"]);
  });
});

describe("fetchHealthDetail (byte-identical delegation, A94)", () => {
  it("forwards the token to the lib getHealthDetail", () => {
    fetchHealthDetail("tok");
    expect(libSpy.getHealthDetail).toHaveBeenCalledWith("tok");
  });
});
