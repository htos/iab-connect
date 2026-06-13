// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * E29-S3: behaviour invariants of the board-documents query + mutation hooks.
 * DEC-1 = A keeps the transport on `documents` (an `ApiResult<T>`
 * shape), so the detail query throws on `!success` — a 404 throws
 * `BoardDocumentNotFoundError`, any other failure a generic Error. The mutations
 * invalidate `boardDocumentsKeys.all` (+ `detail(id)` for the detail-scoped ones)
 * on success (A79 — replacing the god-page's manual refetch).
 */

const serviceSpy = vi.hoisted(() => ({
  getDocumentById: vi.fn(),
  reviewDocument: vi.fn(),
  publishDocument: vi.fn(),
  archiveDocument: vi.fn(),
  deleteDocument: vi.fn(),
  updateDocumentTags: vi.fn(),
  restoreVersion: vi.fn(),
}));
vi.mock("@/features/documents/api/documents-transport", () => ({
  getDocumentById: serviceSpy.getDocumentById,
  reviewDocument: serviceSpy.reviewDocument,
  publishDocument: serviceSpy.publishDocument,
  archiveDocument: serviceSpy.archiveDocument,
  deleteDocument: serviceSpy.deleteDocument,
  updateDocumentTags: serviceSpy.updateDocumentTags,
  restoreVersion: serviceSpy.restoreVersion,
}));

import {
  BoardDocumentNotFoundError,
  useBoardDocument,
} from "./use-board-document";
import { useBoardDocumentMutations } from "./use-board-document-mutations";
import { boardDocumentsKeys } from "../api/board-documents-api";

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      // `retryDelay: 0`: the E29 review (P4) gives `useBoardDocument` a per-query
      // `retry` PREDICATE (404 → no retry; other errors → the provider's
      // `retry: 1`). A function `retry` overrides this client's `retry: false`,
      // so a non-404 error now retries once — `retryDelay: 0` lets that single
      // retry settle instantly so the error-OUTCOME assertions stay fast.
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
  Object.values(serviceSpy).forEach((fn) => fn.mockReset());
});

afterEach(cleanup);

describe("useBoardDocument", () => {
  it("throws BoardDocumentNotFoundError on status 404", async () => {
    serviceSpy.getDocumentById.mockResolvedValue({
      success: false,
      data: null,
      error: undefined,
      status: 404,
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useBoardDocument("doc-1", true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(BoardDocumentNotFoundError);
  });

  it("throws a generic Error on a non-404 failure", async () => {
    serviceSpy.getDocumentById.mockResolvedValue({
      success: false,
      data: null,
      error: "boom",
      status: 500,
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useBoardDocument("doc-1", true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error).not.toBeInstanceOf(BoardDocumentNotFoundError);
    expect((result.current.error as Error).message).toBe("boom");
  });

  it("returns the detail data on success", async () => {
    serviceSpy.getDocumentById.mockResolvedValue({
      success: true,
      data: { id: "doc-1", name: "Statutes" },
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useBoardDocument("doc-1", true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: "doc-1", name: "Statutes" });
  });

  it("does not fetch when disabled (auth gate)", () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useBoardDocument("doc-1", false), { wrapper });
    expect(serviceSpy.getDocumentById).not.toHaveBeenCalled();
  });
});

describe("useBoardDocumentMutations", () => {
  it("changeStatus invalidates the list root + the acted-on detail on success", async () => {
    serviceSpy.reviewDocument.mockResolvedValue({ success: true, data: null });
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useBoardDocumentMutations(), {
      wrapper,
    });
    result.current.changeStatus.mutate({ id: "doc-1", action: "review" });

    await waitFor(() =>
      expect(result.current.changeStatus.isSuccess).toBe(true)
    );
    expect(serviceSpy.reviewDocument).toHaveBeenCalledWith("doc-1");
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: boardDocumentsKeys.all,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: boardDocumentsKeys.detail("doc-1"),
    });
  });

  it("deleteDoc invalidates the list root on success", async () => {
    serviceSpy.deleteDocument.mockResolvedValue({ success: true, data: null });
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useBoardDocumentMutations(), {
      wrapper,
    });
    result.current.deleteDoc.mutate("doc-1");

    await waitFor(() => expect(result.current.deleteDoc.isSuccess).toBe(true));
    expect(serviceSpy.deleteDocument).toHaveBeenCalledWith("doc-1");
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: boardDocumentsKeys.all,
    });
  });

  it("changeStatus throws on API failure so the caller can show the error toast", async () => {
    serviceSpy.publishDocument.mockResolvedValue({
      success: false,
      data: null,
      error: undefined,
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useBoardDocumentMutations(), {
      wrapper,
    });
    result.current.changeStatus.mutate({ id: "doc-1", action: "publish" });

    await waitFor(() => expect(result.current.changeStatus.isError).toBe(true));
  });

  it("updateTags forwards the tags array + invalidates list + detail", async () => {
    serviceSpy.updateDocumentTags.mockResolvedValue({
      success: true,
      data: null,
    });
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useBoardDocumentMutations(), {
      wrapper,
    });
    result.current.updateTags.mutate({ id: "doc-1", tags: ["a", "b"] });

    await waitFor(() => expect(result.current.updateTags.isSuccess).toBe(true));
    expect(serviceSpy.updateDocumentTags).toHaveBeenCalledWith("doc-1", [
      "a",
      "b",
    ]);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: boardDocumentsKeys.detail("doc-1"),
    });
  });

  it("restore forwards the version number + invalidates list + detail", async () => {
    serviceSpy.restoreVersion.mockResolvedValue({ success: true, data: {} });
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useBoardDocumentMutations(), {
      wrapper,
    });
    result.current.restore.mutate({ id: "doc-1", versionNumber: 1 });

    await waitFor(() => expect(result.current.restore.isSuccess).toBe(true));
    expect(serviceSpy.restoreVersion).toHaveBeenCalledWith("doc-1", 1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: boardDocumentsKeys.detail("doc-1"),
    });
  });
});
