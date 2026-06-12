// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * E25-S2: the automations slice api owns the query-key factory and WRAPS the
 * `@/lib/api/automations` transport (DEC-1 = A — no URL re-impl). These assert the
 * key shapes and that each wrapper delegates to the lib fn with byte-identical
 * args (token forwarded, `status: status || undefined`), plus the folded
 * `fetchMemberSegments` raw fetch (`/api/v1/member-segments?pageSize=100` with a
 * Bearer header, `{ items }` → `{ id, name }[]`, degrading to `[]`).
 */

const libSpy = vi.hoisted(() => ({
  listAutomations: vi.fn(() =>
    Promise.resolve({ items: [], totalCount: 0, totalPages: 1 })
  ),
  getAutomation: vi.fn(() => Promise.resolve({ id: "a" })),
  getExecutions: vi.fn(() => Promise.resolve([])),
  createAutomation: vi.fn(() => Promise.resolve({ id: "a" })),
  updateAutomation: vi.fn(() => Promise.resolve({ id: "a" })),
  changeAutomationStatus: vi.fn(() => Promise.resolve({ id: "a" })),
  previewRecipients: vi.fn(() =>
    Promise.resolve({ totalCount: 0, preview: [] })
  ),
}));
vi.mock("@/lib/api/automations", () => ({
  listAutomations: libSpy.listAutomations,
  getAutomation: libSpy.getAutomation,
  getExecutions: libSpy.getExecutions,
  createAutomation: libSpy.createAutomation,
  updateAutomation: libSpy.updateAutomation,
  changeAutomationStatus: libSpy.changeAutomationStatus,
  previewRecipients: libSpy.previewRecipients,
}));

import {
  automationsKeys,
  fetchAutomations,
  fetchAutomation,
  fetchExecutions,
  postAutomation,
  putAutomation,
  postAutomationStatus,
  fetchRecipientPreview,
  fetchMemberSegments,
  type ListAutomationsFilters,
} from "./automations-api";

const baseFilters: ListAutomationsFilters = { page: 1, pageSize: 10 };

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("automationsKeys", () => {
  it("exposes the stable key shapes", () => {
    expect(automationsKeys.all).toEqual(["automations"]);
    expect(automationsKeys.detail("a")).toEqual(["automations", "detail", "a"]);
    expect(automationsKeys.executions("a")).toEqual([
      "automations",
      "executions",
      "a",
    ]);
    expect(automationsKeys.list(baseFilters)).toEqual([
      "automations",
      "list",
      { page: 1, pageSize: 10 },
    ]);
  });

  it("includes every filter field in the list key (refetch-on-filter)", () => {
    expect(
      automationsKeys.list({ page: 2, pageSize: 10, status: "Active" })
    ).toEqual([
      "automations",
      "list",
      { page: 2, pageSize: 10, status: "Active" },
    ]);
  });
});

describe("list/detail/executions wrappers (delegate byte-identically)", () => {
  it("fetchAutomations forwards token + page/pageSize and omits empty status as undefined", () => {
    fetchAutomations("tok", baseFilters);
    expect(libSpy.listAutomations).toHaveBeenCalledWith("tok", {
      page: 1,
      pageSize: 10,
      status: undefined,
    });
  });

  it("fetchAutomations forwards a set status verbatim", () => {
    fetchAutomations("tok", { page: 3, pageSize: 10, status: "Paused" });
    expect(libSpy.listAutomations).toHaveBeenCalledWith("tok", {
      page: 3,
      pageSize: 10,
      status: "Paused",
    });
  });

  it("fetchAutomation forwards token + id", () => {
    fetchAutomation("tok", "id-1");
    expect(libSpy.getAutomation).toHaveBeenCalledWith("tok", "id-1");
  });

  it("fetchExecutions forwards token + id", () => {
    fetchExecutions("tok", "id-1");
    expect(libSpy.getExecutions).toHaveBeenCalledWith("tok", "id-1");
  });
});

describe("write wrappers (delegate byte-identically)", () => {
  it("postAutomation forwards token + body", () => {
    const body = { name: "x" } as never;
    postAutomation("tok", body);
    expect(libSpy.createAutomation).toHaveBeenCalledWith("tok", body);
  });

  it("putAutomation forwards token + id + body", () => {
    const body = { name: "x" } as never;
    putAutomation("tok", "id-1", body);
    expect(libSpy.updateAutomation).toHaveBeenCalledWith("tok", "id-1", body);
  });

  it("postAutomationStatus forwards token + id + action", () => {
    postAutomationStatus("tok", "id-1", "activate");
    expect(libSpy.changeAutomationStatus).toHaveBeenCalledWith(
      "tok",
      "id-1",
      "activate"
    );
  });

  it("fetchRecipientPreview forwards token + body", () => {
    const body = { segmentType: "AllActiveMembers" } as never;
    fetchRecipientPreview("tok", body);
    expect(libSpy.previewRecipients).toHaveBeenCalledWith("tok", body);
  });
});

describe("fetchMemberSegments (folded inline god-page fetch)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ items: [{ id: "seg-1", name: "Segment One" }] }),
        })
      )
    );
  });

  it("GETs /api/v1/member-segments?pageSize=100 with a Bearer header and maps items", async () => {
    const result = await fetchMemberSegments("tok");
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/member-segments?pageSize=100");
    expect(
      (init as { headers: Record<string, string> }).headers.Authorization
    ).toBe("Bearer tok");
    expect(result).toEqual([{ id: "seg-1", name: "Segment One" }]);
  });

  it("degrades to [] on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
      )
    );
    expect(await fetchMemberSegments("tok")).toEqual([]);
  });

  it("degrades to [] when the fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("network")))
    );
    expect(await fetchMemberSegments("tok")).toEqual([]);
  });
});
