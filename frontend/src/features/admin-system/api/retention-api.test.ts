// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * E27-S4: the retention slice api owns the query-key factory and WRAPS the
 * `@/lib/api/retention` transport (DEC-1 = A). Asserts the key shapes + byte-
 * identical delegation (A94).
 */

const libSpy = vi.hoisted(() => ({
  getRetentionPolicies: vi.fn(),
  updateRetentionPolicy: vi.fn(),
  enforceRetention: vi.fn(),
}));
vi.mock("@/lib/api/retention", () => ({
  getRetentionPolicies: (...a: unknown[]) => libSpy.getRetentionPolicies(...a),
  updateRetentionPolicy: (...a: unknown[]) =>
    libSpy.updateRetentionPolicy(...a),
  enforceRetention: (...a: unknown[]) => libSpy.enforceRetention(...a),
}));

import {
  retentionKeys,
  fetchRetentionPolicies,
  postEnforceRetention,
  putRetentionPolicy,
} from "./retention-api";

afterEach(() => vi.clearAllMocks());

describe("retentionKeys", () => {
  it("exposes the stable key shapes", () => {
    expect(retentionKeys.all).toEqual(["retention"]);
    expect(retentionKeys.list()).toEqual(["retention", "list"]);
  });
});

describe("retention api wrappers (byte-identical delegation, A94)", () => {
  it("fetchRetentionPolicies forwards the token", () => {
    fetchRetentionPolicies("tok");
    expect(libSpy.getRetentionPolicies).toHaveBeenCalledWith("tok");
  });

  it("putRetentionPolicy forwards token + id + data", () => {
    const data = {
      displayName: "x",
      retentionMonths: 12,
      action: "Delete",
      legalBasis: null,
      isActive: true,
    };
    putRetentionPolicy("tok", "p1", data);
    expect(libSpy.updateRetentionPolicy).toHaveBeenCalledWith(
      "tok",
      "p1",
      data
    );
  });

  it("postEnforceRetention forwards the token", () => {
    postEnforceRetention("tok");
    expect(libSpy.enforceRetention).toHaveBeenCalledWith("tok");
  });
});
