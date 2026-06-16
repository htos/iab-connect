// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * E26-S5 focused banking/data hook tests (BUILD on the `useApiClient` mock, A94):
 *   - the bank-import UPLOAD mutation (multipart FormData field "file", Content-Type
 *     omitted) + onSuccess list invalidation (A92 — the file-input reset lives in the
 *     content's onSuccess, tested via the S1 net);
 *   - the receipt UPLOAD mutation (FormData "file" + "notes");
 *   - the POST-vs-PUT `/ignore` divergence (useIgnoreItem = POST, useUnmatchItem = PUT,
 *     SAME path);
 *   - the export blob-download helper (object-URL + anchor download + revoke, NOT appended).
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

import {
  useUploadBankImport,
  useIgnoreItem,
  useUnmatchItem,
} from "./use-bank-imports";
import { useUploadTransactionReceipt } from "./use-transaction-receipts";
import { useExportDownloads } from "./use-exports";
import { bankingKeys } from "../api/banking-api";

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
  apiSpy.upload.mockResolvedValue({ data: {}, error: null, status: 200 });
  apiSpy.post.mockResolvedValue({ data: {}, error: null, status: 200 });
  apiSpy.put.mockResolvedValue({ data: {}, error: null, status: 200 });
});

afterEach(cleanup);

describe("useUploadBankImport — multipart FormData field 'file' + onSuccess invalidation", () => {
  it("calls api.upload with the bank-imports endpoint and a FormData carrying ONLY 'file'", async () => {
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useUploadBankImport(), { wrapper });

    const file = new File(["a,b\n1,2"], "statement.csv", { type: "text/csv" });
    result.current.mutate(file);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiSpy.upload).toHaveBeenCalledWith(
      "/api/v1/finance/bank-imports",
      expect.any(FormData)
    );
    const fd = apiSpy.upload.mock.calls[0][1] as FormData;
    // Pin the EXACT field name + that the File is carried verbatim (no JSON mutation).
    expect(fd.get("file")).toBe(file);
    expect(fd.get("notes")).toBeNull();
    // A92 / list refetch: invalidates the bank-imports key on success.
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: bankingKeys.bankImports(),
    });
  });
});

describe("useUploadTransactionReceipt — multipart FormData 'file' + 'notes'", () => {
  it("calls api.upload to /receipts carrying BOTH 'file' and 'notes'", async () => {
    const { wrapper } = makeWrapper();
    apiSpy.upload.mockResolvedValue({
      data: { id: "rcpt-new" },
      error: null,
      status: 200,
    });
    const { result } = renderHook(() => useUploadTransactionReceipt(), {
      wrapper,
    });

    const file = new File(["x"], "r.pdf", { type: "application/pdf" });
    result.current.mutate({ file, notes: "expense scan" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiSpy.upload).toHaveBeenCalledWith(
      "/api/v1/finance/receipts",
      expect.any(FormData)
    );
    const fd = apiSpy.upload.mock.calls[0][1] as FormData;
    expect(fd.get("file")).toBe(file);
    expect(fd.get("notes")).toBe("expense scan");
    // The new receipt id is returned for the caller to link.
    expect(result.current.data?.data).toEqual({ id: "rcpt-new" });
  });
});

describe("bank-import /ignore — POST (ignore) vs PUT (unmatch) on the SAME path", () => {
  it("useIgnoreItem POSTs .../items/{id}/ignore and does NOT PUT it", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useIgnoreItem(), { wrapper });
    result.current.mutate({ importId: "imp-1", itemId: "item-unmatched" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiSpy.post).toHaveBeenCalledWith(
      "/api/v1/finance/bank-imports/imp-1/items/item-unmatched/ignore",
      {}
    );
    expect(apiSpy.put).not.toHaveBeenCalledWith(
      "/api/v1/finance/bank-imports/imp-1/items/item-unmatched/ignore",
      expect.anything()
    );
  });

  it("useUnmatchItem PUTs .../items/{id}/ignore and does NOT POST it", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUnmatchItem(), { wrapper });
    result.current.mutate({ importId: "imp-1", itemId: "item-ignored" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiSpy.put).toHaveBeenCalledWith(
      "/api/v1/finance/bank-imports/imp-1/items/item-ignored/ignore",
      {}
    );
    expect(apiSpy.post).not.toHaveBeenCalledWith(
      "/api/v1/finance/bank-imports/imp-1/items/item-ignored/ignore",
      expect.anything()
    );
  });
});

describe("useExportDownloads — blob → object-URL → non-appended anchor → click → revoke", () => {
  it("journal export: string-interpolated URL, hardcoded journal.csv, anchor NOT appended", async () => {
    global.URL.createObjectURL = vi.fn(() => "blob:mock");
    global.URL.revokeObjectURL = vi.fn();
    const CSV = new Blob(["a;b"], { type: "text/csv" });
    apiSpy.get.mockResolvedValue({ data: CSV, error: null, status: 200 });

    const created: HTMLAnchorElement[] = [];
    const orig = document.createElement.bind(document);
    const createSpy = vi.spyOn(document, "createElement").mockImplementation(((
      tag: string
    ) => {
      const el = orig(tag);
      if (tag === "a") {
        (el as HTMLAnchorElement).click = vi.fn();
        created.push(el as HTMLAnchorElement);
      }
      return el;
    }) as typeof document.createElement);
    const appendSpy = vi.spyOn(document.body, "appendChild");

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useExportDownloads(), { wrapper });
    await result.current.exportJournal("2026-01-01", "2026-03-31");

    expect(apiSpy.get).toHaveBeenCalledWith(
      "/api/v1/finance/exports/journal?from=2026-01-01&to=2026-03-31"
    );
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(CSV);
    const anchor = created.find((a) => a.download === "journal.csv");
    expect(anchor).toBeTruthy();
    expect(anchor!.click).toHaveBeenCalled();
    // Exports-specific: the anchor is NEVER appended to document.body.
    expect(appendSpy).not.toHaveBeenCalledWith(anchor!);
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");

    createSpy.mockRestore();
    appendSpy.mockRestore();
  });

  it("open-items export: fixed URL, hardcoded open-items.csv", async () => {
    global.URL.createObjectURL = vi.fn(() => "blob:mock");
    global.URL.revokeObjectURL = vi.fn();
    const CSV = new Blob(["a;b"], { type: "text/csv" });
    apiSpy.get.mockResolvedValue({ data: CSV, error: null, status: 200 });

    const created: HTMLAnchorElement[] = [];
    const orig = document.createElement.bind(document);
    const createSpy = vi.spyOn(document, "createElement").mockImplementation(((
      tag: string
    ) => {
      const el = orig(tag);
      if (tag === "a") {
        (el as HTMLAnchorElement).click = vi.fn();
        created.push(el as HTMLAnchorElement);
      }
      return el;
    }) as typeof document.createElement);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useExportDownloads(), { wrapper });
    await result.current.exportOpenItems();

    expect(apiSpy.get).toHaveBeenCalledWith(
      "/api/v1/finance/exports/open-items"
    );
    const anchor = created.find((a) => a.download === "open-items.csv");
    expect(anchor).toBeTruthy();
    expect(anchor!.click).toHaveBeenCalled();

    createSpy.mockRestore();
  });

  it("journal export throws on res.error (so the content surfaces loadError)", async () => {
    apiSpy.get.mockResolvedValue({ data: null, error: "boom", status: 500 });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useExportDownloads(), { wrapper });
    await expect(
      result.current.exportJournal("2026-01-01", "2026-03-31")
    ).rejects.toThrow("boom");
  });
});
