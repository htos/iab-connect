// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * E26-S2 focused hook tests: the dashboard composite query (4 GETs → one bag), the
 * journal detail/edit-load no-retry (A99), and a mutation-invalidation (save-account →
 * invalidates the accounts key). All BUILD on the `useApiClient` mock (A94).
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

import { useFinanceDashboard } from "./use-finance-dashboard";
import { useJournalEntryDetail } from "./use-journal-entries";
import { useSaveAccount } from "./use-accounts";
import { financeKeys } from "../api/finance-api";

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

describe("useFinanceDashboard — composite query", () => {
  it("folds the four GETs into one bag (open-invoices reduced, transactions sliced)", async () => {
    apiSpy.get.mockImplementation((url: string) => {
      if (url === "/api/v1/finance/transactions/summary")
        return Promise.resolve({
          data: { totalIncome: 1000, totalExpense: 400, balance: 600 },
          error: null,
          status: 200,
        });
      if (url === "/api/v1/finance/dashboard")
        return Promise.resolve({
          data: { invoicesOpenCount: 5 },
          error: null,
          status: 200,
        });
      if (url === "/api/v1/finance/invoices/open")
        return Promise.resolve({
          data: [
            { id: "i1", total: 100 },
            { id: "i2", total: 150 },
          ],
          error: null,
          status: 200,
        });
      if (url === "/api/v1/finance/transactions")
        return Promise.resolve({
          data: { items: [{ id: "t1", description: "Fee" }] },
          error: null,
          status: 200,
        });
      return Promise.resolve({ data: null, error: null, status: 200 });
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useFinanceDashboard(true), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.summary?.balance).toBe(600);
    expect(result.current.data?.openInvoices).toEqual({
      count: 2,
      totalAmount: 250,
    });
    expect(result.current.data?.recentTransactions).toHaveLength(1);
  });

  it("does not fetch when disabled (auth gate)", () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useFinanceDashboard(false), { wrapper });
    expect(apiSpy.get).not.toHaveBeenCalled();
  });
});

describe("useJournalEntryDetail — A99 no-retry", () => {
  it("does NOT retry on a failed detail GET (single call)", async () => {
    apiSpy.get.mockResolvedValue({ data: null, error: "boom", status: 500 });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useJournalEntryDetail("j1"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    // retry:false → exactly one GET fired (no retry storm).
    expect(apiSpy.get).toHaveBeenCalledTimes(1);
    expect(apiSpy.get).toHaveBeenCalledWith(
      "/api/v1/finance/journal-entries/j1"
    );
  });

  it("is disabled when id is null (no GET)", () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useJournalEntryDetail(null), { wrapper });
    expect(apiSpy.get).not.toHaveBeenCalled();
  });
});

describe("useSaveAccount — mutation invalidation", () => {
  it("invalidates the accounts key on success (POST create)", async () => {
    apiSpy.post.mockResolvedValue({ data: {}, error: null, status: 200 });
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useSaveAccount(), { wrapper });
    result.current.mutate({
      id: null,
      form: {
        name: "Acc",
        number: "1099",
        type: "Bank",
        description: "",
        isActive: true,
        sortOrder: 0,
      },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiSpy.post).toHaveBeenCalledWith(
      "/api/v1/finance/accounts",
      expect.objectContaining({ name: "Acc", number: "1099" })
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: financeKeys.accounts(),
    });
  });
});
