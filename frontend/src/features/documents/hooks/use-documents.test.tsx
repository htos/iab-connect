// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * E29-S2: behaviour invariants of the documents query + download hooks. DEC-1=A
 * keeps the transport on `documents` (an `ApiResult<T>` shape), so
 * the query hooks throw on `!result.success` to drive TanStack rejection; this
 * pins that branch plus the success path, the `enabled` gate, and the
 * `use-document-download` side-effect (success creates+revokes an object URL +
 * clicks the anchor; failure is surfaced to the caller — A76).
 */

// A single mutable spy object so each test drives the shared service result. The
// data fns live in the relocated transport; `getDownloadUrl` is a pure helper
// that now lives in `@/types/documents` (E31-S1), so it is mocked separately.
const serviceSpy = vi.hoisted(() => ({
  getDocuments: vi.fn(),
  getFolders: vi.fn(),
  getAllTags: vi.fn(),
  getDownloadUrl: vi.fn(
    (id: string) => `http://localhost:5000/api/v1/documents/${id}/download`
  ),
}));
vi.mock("@/features/documents/api/documents-transport", () => ({
  getDocuments: serviceSpy.getDocuments,
  getFolders: serviceSpy.getFolders,
  getAllTags: serviceSpy.getAllTags,
}));
vi.mock("@/types/documents", async (importActual) => ({
  ...(await importActual<typeof import("@/types/documents")>()),
  getDownloadUrl: serviceSpy.getDownloadUrl,
}));

import { useDocuments } from "./use-documents";
import { useDocumentTags } from "./use-document-tags";
import { useDocumentDownload } from "./use-document-download";

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

const FILTERS = { page: 1, pageSize: 20 };

beforeEach(() => {
  serviceSpy.getDocuments.mockReset();
  serviceSpy.getFolders.mockReset();
  serviceSpy.getAllTags.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useDocuments", () => {
  it("returns the paged result on success", async () => {
    const data = { items: [{ id: "d1" }], totalCount: 1, totalPages: 1 };
    serviceSpy.getDocuments.mockResolvedValue({ success: true, data });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDocuments(FILTERS, true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(data);
  });

  it("throws when the service returns !success (drives TanStack rejection)", async () => {
    serviceSpy.getDocuments.mockResolvedValue({
      success: false,
      data: undefined,
      error: "boom",
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDocuments(FILTERS, true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("boom");
  });

  it("does not fetch when disabled (auth gate)", () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useDocuments(FILTERS, false), { wrapper });
    expect(serviceSpy.getDocuments).not.toHaveBeenCalled();
  });
});

describe("useDocumentTags", () => {
  it("does not fetch when disabled (auth gate)", () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useDocumentTags(false), { wrapper });
    expect(serviceSpy.getAllTags).not.toHaveBeenCalled();
  });
});

describe("useDocumentDownload", () => {
  const DOC = { id: "doc-1", name: "Annual Report.pdf" } as never;

  beforeEach(() => {
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: vi.fn(() => "blob:mock"),
        revokeObjectURL: vi.fn(),
      })
    );
  });

  it("success: tokenised fetch, creates+revokes the object URL, clicks the anchor, returns null", async () => {
    const blob = new Blob(["pdf-bytes"]);
    const fetchMock = vi.fn(() =>
      Promise.resolve({ blob: () => Promise.resolve(blob) } as Response)
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.doMock("next-auth/react", () => ({
      getSession: vi.fn(() => Promise.resolve({ accessToken: "tok-123" })),
    }));
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click");

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDocumentDownload(), { wrapper });

    const outcome = await result.current.download(DOC);

    expect(serviceSpy.getDownloadUrl).toHaveBeenCalledWith("doc-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:5000/api/v1/documents/doc-1/download",
      expect.objectContaining({
        headers: { Authorization: "Bearer tok-123" },
      })
    );
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    expect(clickSpy).toHaveBeenCalled();
    expect(outcome).toBeNull();

    clickSpy.mockRestore();
    vi.doUnmock("next-auth/react");
  });

  it("failure: surfaces the error to the caller (A76) instead of throwing", async () => {
    vi.doMock("next-auth/react", () => ({
      getSession: vi.fn(() => Promise.resolve({ accessToken: "tok-123" })),
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("network down")))
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDocumentDownload(), { wrapper });

    const outcome = await result.current.download(DOC);

    expect(outcome).toBeInstanceOf(Error);
    expect((outcome as Error).message).toBe("network down");

    vi.doUnmock("next-auth/react");
  });
});
