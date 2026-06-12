// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * E27-S4: the audit slice api owns the query-key factory and WRAPS the
 * `@/lib/api/audit` transport (DEC-1 = A). These assert the key shapes (the FULL
 * filters object is in the list key → server-side refetch-on-filter) and that each
 * wrapper delegates to the lib fn with the token + filters byte-identically (A94).
 */

const libSpy = vi.hoisted(() => ({
  getAuditEvents: vi.fn(),
  exportAuditEvents: vi.fn(),
  getAuditCategories: vi.fn(),
  getAuditEventTypes: vi.fn(),
}));
vi.mock("@/lib/api/audit", () => ({
  getAuditEvents: (...a: unknown[]) => libSpy.getAuditEvents(...a),
  exportAuditEvents: (...a: unknown[]) => libSpy.exportAuditEvents(...a),
  getAuditCategories: (...a: unknown[]) => libSpy.getAuditCategories(...a),
  getAuditEventTypes: (...a: unknown[]) => libSpy.getAuditEventTypes(...a),
}));

import {
  auditKeys,
  fetchAuditCategories,
  fetchAuditEventTypes,
  fetchAuditEvents,
  fetchAuditExport,
} from "./audit-api";

afterEach(() => vi.clearAllMocks());

describe("auditKeys", () => {
  it("exposes the stable key roots", () => {
    expect(auditKeys.all).toEqual(["audit"]);
    expect(auditKeys.categories()).toEqual(["audit", "categories"]);
    expect(auditKeys.eventTypes()).toEqual(["audit", "event-types"]);
  });

  it("includes the FULL filters object in the list key (server-side refetch-on-filter)", () => {
    expect(auditKeys.list({ page: 1, pageSize: 50 })).toEqual([
      "audit",
      "list",
      { page: 1, pageSize: 50 },
    ]);
    expect(
      auditKeys.list({
        page: 2,
        pageSize: 50,
        severity: "Warning",
        search: "x",
      })
    ).toEqual([
      "audit",
      "list",
      { page: 2, pageSize: 50, severity: "Warning", search: "x" },
    ]);
  });

  it("produces distinct keys for distinct filter sets (refetch trigger)", () => {
    const a = auditKeys.list({ page: 1, pageSize: 50 });
    const b = auditKeys.list({ page: 1, pageSize: 50, severity: "Critical" });
    expect(a).not.toEqual(b);
  });
});

describe("audit api wrappers (byte-identical delegation, A94)", () => {
  it("fetchAuditEvents forwards token + filters to the lib fn", () => {
    const filters = { page: 1, pageSize: 50, severity: "Warning" };
    fetchAuditEvents("tok", filters);
    expect(libSpy.getAuditEvents).toHaveBeenCalledWith("tok", filters);
  });

  it("fetchAuditExport forwards token + filters to the lib fn", () => {
    const filters = { page: 1, pageSize: 50 };
    fetchAuditExport("tok", filters);
    expect(libSpy.exportAuditEvents).toHaveBeenCalledWith("tok", filters);
  });

  it("fetchAuditCategories + fetchAuditEventTypes forward the token", () => {
    fetchAuditCategories("tok");
    fetchAuditEventTypes("tok");
    expect(libSpy.getAuditCategories).toHaveBeenCalledWith("tok");
    expect(libSpy.getAuditEventTypes).toHaveBeenCalledWith("tok");
  });
});
