// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * E26-S3 focused hook tests (BUILD on the `useApiClient` mock, A94):
 *  - invoice-detail no-retry (A99): a failing detail GET is called EXACTLY once.
 *  - mutation-invalidation: detail Cancel (POST /cancel) invalidates the detail key.
 *  - optimistic-list-patch preservation (A100): the list Send/Cancel mutations do NOT
 *    invalidate or refetch the invoices list — the content owns the local status overlay.
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

import { useInvoiceDetail, useCancelInvoiceDetail } from "./use-invoice-detail";
import {
  useInvoices,
  useSendInvoice,
  useCancelInvoiceFromList,
} from "./use-invoices";
import { receivablesKeys } from "../api/receivables-api";

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
  apiSpy.upload.mockReset();
});

afterEach(cleanup);

describe("useInvoiceDetail — A99 retry:false", () => {
  it("calls the detail GET exactly once on failure (no retry)", async () => {
    apiSpy.get.mockResolvedValue({ data: null, error: "boom", status: 500 });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useInvoiceDetail("inv-1", true), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(
      apiSpy.get.mock.calls.filter(
        (c) => c[0] === "/api/v1/finance/invoices/inv-1"
      ).length
    ).toBe(1);
  });
});

describe("useCancelInvoiceDetail — POST /cancel + detail invalidation", () => {
  it("POSTs /invoices/{id}/cancel and invalidates the detail key", async () => {
    apiSpy.post.mockResolvedValue({ data: {}, error: null, status: 200 });
    const { queryClient, wrapper } = makeWrapper();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCancelInvoiceDetail("inv-1"), {
      wrapper,
    });
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiSpy.post).toHaveBeenCalledWith(
      "/api/v1/finance/invoices/inv-1/cancel",
      {}
    );
    expect(spy).toHaveBeenCalledWith({
      queryKey: receivablesKeys.invoice("inv-1"),
    });
  });
});

describe("useSendInvoice / useCancelInvoiceFromList — A100 no list refetch", () => {
  it("Send POSTs /send and does NOT refetch the invoices list", async () => {
    apiSpy.get.mockResolvedValue({
      data: { items: [{ id: "inv-1", status: "Draft" }] },
      error: null,
      status: 200,
    });
    apiSpy.post.mockResolvedValue({ data: {}, error: null, status: 200 });
    const { wrapper } = makeWrapper();
    const list = renderHook(() => useInvoices("", "", "", true), { wrapper });
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
    const getsBefore = apiSpy.get.mock.calls.length;

    const send = renderHook(() => useSendInvoice(), { wrapper });
    send.result.current.mutate("inv-1");
    await waitFor(() => expect(send.result.current.isSuccess).toBe(true));
    expect(apiSpy.post).toHaveBeenCalledWith(
      "/api/v1/finance/invoices/inv-1/send",
      {}
    );
    // No list refetch fired (A100 — no invalidation in the mutation).
    expect(apiSpy.get.mock.calls.length).toBe(getsBefore);
  });

  it("list Cancel DELETEs /invoices/{id} (NOT POST /cancel) with no list refetch", async () => {
    apiSpy.get.mockResolvedValue({
      data: { items: [{ id: "inv-1", status: "Draft" }] },
      error: null,
      status: 200,
    });
    apiSpy.delete.mockResolvedValue({ data: null, error: null, status: 200 });
    const { wrapper } = makeWrapper();
    const list = renderHook(() => useInvoices("", "", "", true), { wrapper });
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
    const getsBefore = apiSpy.get.mock.calls.length;

    const cancel = renderHook(() => useCancelInvoiceFromList(), { wrapper });
    cancel.result.current.mutate("inv-1");
    await waitFor(() => expect(cancel.result.current.isSuccess).toBe(true));
    expect(apiSpy.delete).toHaveBeenCalledWith(
      "/api/v1/finance/invoices/inv-1"
    );
    expect(apiSpy.post).not.toHaveBeenCalledWith(
      "/api/v1/finance/invoices/inv-1/cancel",
      expect.anything()
    );
    expect(apiSpy.get.mock.calls.length).toBe(getsBefore);
  });
});
