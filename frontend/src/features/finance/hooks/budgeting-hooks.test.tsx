// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * E26-S4 focused hook tests (BUILD on the `useApiClient` mock — A94):
 *  - the budget save mutation invalidates the budgets list key (refetch on success),
 *  - the budget-vs-actual report query is ON-DEMAND (`enabled` only when generate +
 *    !!fiscalPeriodId — no GET on mount / without a period),
 *  - the CSV export streams a raw blob → object-URL → anchor download (NOT a query),
 *  - the activity-area toggle-active PUTs the SAME /{id} with isActive flipped.
 */

const apiSpy = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  upload: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  useApiClient: () => apiSpy,
  useAuth: () => ({ accessToken: "tok" }),
}));

import { useSaveBudget, useBudgets } from "./use-budgets";
import {
  useBudgetVsActualReport,
  exportBudgetVsActualCsv,
} from "./use-budget-vs-actual";
import { useToggleActivityAreaActive } from "./use-activity-areas-crud";

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0 },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

beforeEach(() => {
  apiSpy.get.mockReset();
  apiSpy.post.mockReset();
  apiSpy.put.mockReset();
  apiSpy.delete.mockReset();
});

afterEach(cleanup);

describe("useSaveBudget — mutation-invalidation", () => {
  it("POSTs a new budget then invalidates the budgets list key", async () => {
    apiSpy.post.mockResolvedValue({ data: {}, error: null });
    apiSpy.get.mockResolvedValue({ data: [], error: null });
    const { queryClient, wrapper } = makeWrapper();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useSaveBudget(), { wrapper });
    result.current.mutate({
      editingId: null,
      activityAreaId: "a1",
      fiscalPeriodId: "p1",
      amount: 250,
      currency: "CHF",
      notes: null,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiSpy.post).toHaveBeenCalledWith(
      "/api/v1/finance/budgets",
      expect.objectContaining({ activityAreaId: "a1", fiscalPeriodId: "p1" })
    );
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["finance", "budgets"] })
    );
  });

  it("PUTs an edit to /{id} with amount-only (no area/period) and invalidates", async () => {
    apiSpy.put.mockResolvedValue({ data: {}, error: null });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSaveBudget(), { wrapper });
    result.current.mutate({
      editingId: "b1",
      activityAreaId: "a1",
      fiscalPeriodId: "p1",
      amount: 1500,
      currency: "CHF",
      notes: "Diwali",
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiSpy.put).toHaveBeenCalledWith("/api/v1/finance/budgets/b1", {
      amount: 1500,
      currency: "CHF",
      notes: "Diwali",
    });
    const payload = apiSpy.put.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("activityAreaId");
    expect(payload).not.toHaveProperty("fiscalPeriodId");
  });
});

describe("useBudgets — server filter query string", () => {
  it("requests with NO query string when no filter is set", async () => {
    apiSpy.get.mockResolvedValue({ data: [], error: null });
    const { wrapper } = makeWrapper();
    renderHook(
      () => useBudgets({ activityAreaId: "", fiscalPeriodId: "" }, true),
      { wrapper }
    );
    await waitFor(() =>
      expect(apiSpy.get).toHaveBeenCalledWith("/api/v1/finance/budgets")
    );
  });

  it("appends the active filters to the budgets GET", async () => {
    apiSpy.get.mockResolvedValue({ data: [], error: null });
    const { wrapper } = makeWrapper();
    renderHook(
      () => useBudgets({ activityAreaId: "a1", fiscalPeriodId: "" }, true),
      { wrapper }
    );
    await waitFor(() =>
      expect(apiSpy.get).toHaveBeenCalledWith(
        "/api/v1/finance/budgets?activityAreaId=a1"
      )
    );
  });
});

describe("useBudgetVsActualReport — on-demand enabled gate", () => {
  it("does NOT fire the report GET until generate is armed", async () => {
    apiSpy.get.mockResolvedValue({ data: { rows: [] }, error: null });
    const { wrapper } = makeWrapper();
    renderHook(
      () =>
        useBudgetVsActualReport({
          fiscalPeriodId: "p1",
          activityAreaId: "",
          generate: false,
        }),
      { wrapper }
    );
    // No GET — the query is disabled while generate is false.
    await new Promise((r) => setTimeout(r, 0));
    expect(apiSpy.get).not.toHaveBeenCalled();
  });

  it("does NOT fire without a period even when generate is armed", async () => {
    apiSpy.get.mockResolvedValue({ data: { rows: [] }, error: null });
    const { wrapper } = makeWrapper();
    renderHook(
      () =>
        useBudgetVsActualReport({
          fiscalPeriodId: "",
          activityAreaId: "",
          generate: true,
        }),
      { wrapper }
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(apiSpy.get).not.toHaveBeenCalled();
  });

  it("fires the on-demand report GET with fiscalPeriodId once generate + period are set", async () => {
    apiSpy.get.mockResolvedValue({
      data: { fiscalPeriodName: "2026-01", rows: [] },
      error: null,
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () =>
        useBudgetVsActualReport({
          fiscalPeriodId: "p1",
          activityAreaId: "a1",
          generate: true,
        }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiSpy.get).toHaveBeenCalledWith(
      "/api/v1/finance/budgets/budget-vs-actual?fiscalPeriodId=p1&activityAreaId=a1"
    );
  });
});

describe("exportBudgetVsActualCsv — raw blob download (not a query)", () => {
  it("GETs the cross-base /exports URL, builds an object-URL, downloads budget-vs-actual.csv, revokes", async () => {
    const createObjectURL = vi.fn(() => "blob:mock-csv");
    const revokeObjectURL = vi.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;
    let downloadName: string | null = null;
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloadName = this.download;
      });

    const blob = new Blob(["a,b,c"], { type: "text/csv" });
    apiSpy.get.mockResolvedValue({ data: blob, error: null });

    await exportBudgetVsActualCsv(apiSpy, {
      fiscalPeriodId: "p1",
      activityAreaId: "",
    });

    expect(apiSpy.get).toHaveBeenCalledWith(
      "/api/v1/finance/exports/budget-vs-actual?fiscalPeriodId=p1"
    );
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(downloadName).toBe("budget-vs-actual.csv");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-csv");
    clickSpy.mockRestore();
  });
});

describe("useToggleActivityAreaActive — PUT same /{id} with isActive flipped", () => {
  it("PUTs the full payload to /activity-areas/{id} with isActive negated", async () => {
    apiSpy.put.mockResolvedValue({ data: {}, error: null });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useToggleActivityAreaActive(), {
      wrapper,
    });
    result.current.mutate({
      id: "a1",
      name: "Events",
      code: "EVT",
      description: "Cultural events",
      color: "#f97316",
      isActive: true,
      sortOrder: 0,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiSpy.put).toHaveBeenCalledWith(
      "/api/v1/finance/activity-areas/a1",
      expect.objectContaining({
        name: "Events",
        code: "EVT",
        isActive: false,
      })
    );
  });
});
