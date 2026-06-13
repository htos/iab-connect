import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * E29-S3: the board-documents slice api owns the `boardDocumentsKeys` factory and
 * wraps the shared `documents` transport (DEC-1 = A — no URL
 * re-impl for the JSON endpoints). These assert the key shapes and that each
 * wrapper delegates to the service with the byte-identical params the god-page
 * used: `page`/`pageSize` always; empty `search`/`status`/`category`/`folderId`
 * omitted (sent as `undefined`); the status POSTs / delete / tags PUT
 * `{ tags }` / restore / download-URL builder forwarded verbatim. The two
 * FormData uploads (DEC-1 = A keeps them on raw `fetch` + `getSession` token)
 * are asserted against a stubbed global fetch.
 */

const serviceSpy = vi.hoisted(() => ({
  getDocuments: vi.fn(() =>
    Promise.resolve({ success: true, data: { items: [] } })
  ),
  getFolders: vi.fn(() => Promise.resolve({ success: true, data: [] })),
  getAllTags: vi.fn(() => Promise.resolve({ success: true, data: [] })),
  getDocumentById: vi.fn(() => Promise.resolve({ success: true, data: {} })),
  reviewDocument: vi.fn(() => Promise.resolve({ success: true, data: null })),
  publishDocument: vi.fn(() => Promise.resolve({ success: true, data: null })),
  archiveDocument: vi.fn(() => Promise.resolve({ success: true, data: null })),
  deleteDocument: vi.fn(() => Promise.resolve({ success: true, data: null })),
  updateDocumentTags: vi.fn(() =>
    Promise.resolve({ success: true, data: null })
  ),
  restoreVersion: vi.fn(() => Promise.resolve({ success: true, data: {} })),
  getDownloadUrl: vi.fn((id: string, v?: number) =>
    v
      ? `http://localhost:5000/api/v1/documents/${id}/versions/${v}/download`
      : `http://localhost:5000/api/v1/documents/${id}/download`
  ),
}));
vi.mock("@/features/documents/api/documents-transport", () => ({
  getDocuments: serviceSpy.getDocuments,
  getFolders: serviceSpy.getFolders,
  getAllTags: serviceSpy.getAllTags,
  getDocumentById: serviceSpy.getDocumentById,
  reviewDocument: serviceSpy.reviewDocument,
  publishDocument: serviceSpy.publishDocument,
  archiveDocument: serviceSpy.archiveDocument,
  deleteDocument: serviceSpy.deleteDocument,
  updateDocumentTags: serviceSpy.updateDocumentTags,
  restoreVersion: serviceSpy.restoreVersion,
}));
// `getDownloadUrl` is a pure helper that now lives in `@/types/documents` (E31-S1).
vi.mock("@/types/documents", async (importActual) => ({
  ...(await importActual<typeof import("@/types/documents")>()),
  getDownloadUrl: serviceSpy.getDownloadUrl,
}));

// The FormData uploads dynamically import getSession for the Bearer token.
vi.mock("next-auth/react", () => ({
  getSession: vi.fn(() => Promise.resolve({ accessToken: "tok-123" })),
}));

import {
  DOCUMENTS_BASE,
  DOCUMENT_FOLDERS_BASE,
  boardDocumentsKeys,
  fetchBoardDocuments,
  fetchBoardFolders,
  fetchBoardTags,
  getBoardDocument,
  reviewBoardDocument,
  publishBoardDocument,
  archiveBoardDocument,
  deleteBoardDocument,
  updateBoardDocumentTags,
  restoreBoardDocumentVersion,
  getBoardDocumentDownloadUrl,
  uploadBoardDocument,
  uploadBoardDocumentVersion,
  type ListBoardDocumentsFilters,
} from "./board-documents-api";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }))
  );
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const baseFilters: ListBoardDocumentsFilters = { page: 1, pageSize: 20 };

describe("board endpoint bases", () => {
  it("exposes the byte-identical /api/v1 bases", () => {
    expect(DOCUMENTS_BASE).toBe("/api/v1/documents");
    expect(DOCUMENT_FOLDERS_BASE).toBe("/api/v1/document-folders");
  });
});

describe("boardDocumentsKeys", () => {
  it("exposes the stable key shapes rooted at board-documents (no S2 collision)", () => {
    expect(boardDocumentsKeys.all).toEqual(["board-documents"]);
    expect(boardDocumentsKeys.detail("doc-1")).toEqual([
      "board-documents",
      "detail",
      "doc-1",
    ]);
    expect(boardDocumentsKeys.list(baseFilters)).toEqual([
      "board-documents",
      "list",
      { page: 1, pageSize: 20 },
    ]);
  });

  it("includes every filter field in the list key (refetch-on-filter)", () => {
    expect(
      boardDocumentsKeys.list({
        page: 2,
        pageSize: 20,
        search: "report",
        status: "Published",
        category: "Protocol",
        folderId: "folder-a",
      })
    ).toEqual([
      "board-documents",
      "list",
      {
        page: 2,
        pageSize: 20,
        search: "report",
        status: "Published",
        category: "Protocol",
        folderId: "folder-a",
      },
    ]);
  });
});

describe("fetchBoardDocuments (delegates to the shared service, params byte-identical)", () => {
  it("forwards page + pageSize and omits empty filters as undefined", () => {
    fetchBoardDocuments(baseFilters);
    expect(serviceSpy.getDocuments).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      search: undefined,
      folderId: undefined,
      status: undefined,
      category: undefined,
    });
  });

  it("forwards search/status/category/folderId verbatim when set", () => {
    fetchBoardDocuments({
      page: 3,
      pageSize: 20,
      search: "report",
      status: "Draft",
      category: "Invoice",
      folderId: "folder-a",
    });
    expect(serviceSpy.getDocuments).toHaveBeenCalledWith({
      page: 3,
      pageSize: 20,
      search: "report",
      folderId: "folder-a",
      status: "Draft",
      category: "Invoice",
    });
  });
});

describe("read + workflow + tags + restore wrappers (delegate verbatim)", () => {
  it("fetchBoardFolders forwards the parentId (undefined = root)", () => {
    fetchBoardFolders();
    expect(serviceSpy.getFolders).toHaveBeenCalledWith(undefined);
    fetchBoardFolders("folder-a");
    expect(serviceSpy.getFolders).toHaveBeenCalledWith("folder-a");
  });

  it("fetchBoardTags delegates to the tags endpoint", () => {
    fetchBoardTags();
    expect(serviceSpy.getAllTags).toHaveBeenCalledTimes(1);
  });

  it("getBoardDocument forwards the id", () => {
    getBoardDocument("doc-1");
    expect(serviceSpy.getDocumentById).toHaveBeenCalledWith("doc-1");
  });

  it("review/publish/archive/delete forward the id verbatim", () => {
    reviewBoardDocument("doc-1");
    publishBoardDocument("doc-2");
    archiveBoardDocument("doc-3");
    deleteBoardDocument("doc-4");
    expect(serviceSpy.reviewDocument).toHaveBeenCalledWith("doc-1");
    expect(serviceSpy.publishDocument).toHaveBeenCalledWith("doc-2");
    expect(serviceSpy.archiveDocument).toHaveBeenCalledWith("doc-3");
    expect(serviceSpy.deleteDocument).toHaveBeenCalledWith("doc-4");
  });

  it("updateBoardDocumentTags forwards the id + tags array (service builds the { tags } body)", () => {
    updateBoardDocumentTags("doc-1", ["a", "b"]);
    expect(serviceSpy.updateDocumentTags).toHaveBeenCalledWith("doc-1", [
      "a",
      "b",
    ]);
  });

  it("restoreBoardDocumentVersion forwards the id + version number", () => {
    restoreBoardDocumentVersion("doc-1", 2);
    expect(serviceSpy.restoreVersion).toHaveBeenCalledWith("doc-1", 2);
  });

  it("getBoardDocumentDownloadUrl delegates to the service URL builder (current + per-version)", () => {
    expect(getBoardDocumentDownloadUrl("doc-1")).toBe(
      "http://localhost:5000/api/v1/documents/doc-1/download"
    );
    expect(serviceSpy.getDownloadUrl).toHaveBeenCalledWith("doc-1", undefined);
    expect(getBoardDocumentDownloadUrl("doc-1", 3)).toBe(
      "http://localhost:5000/api/v1/documents/doc-1/versions/3/download"
    );
    expect(serviceSpy.getDownloadUrl).toHaveBeenCalledWith("doc-1", 3);
  });
});

describe("FormData uploads (raw fetch + getSession Bearer token, byte-identical shape)", () => {
  it("uploadBoardDocument POSTs FormData to /api/v1/documents with the field set", async () => {
    const file = new File(["x"], "policy.pdf", { type: "application/pdf" });
    await uploadBoardDocument({
      file,
      name: "Policy",
      folderId: "folder-1",
      category: "General",
      description: "desc",
      tags: "legal",
    });

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:5000/api/v1/documents");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok-123");
    const body = init.body as FormData;
    expect(body.get("file")).toBe(file);
    expect(body.get("name")).toBe("Policy");
    expect(body.get("folderId")).toBe("folder-1");
    expect(body.get("category")).toBe("General");
    expect(body.get("description")).toBe("desc");
    expect(body.get("tags")).toBe("legal");
  });

  it("uploadBoardDocument defaults the name to the file name when blank + omits empty description/tags", async () => {
    const file = new File(["x"], "report.pdf", { type: "application/pdf" });
    await uploadBoardDocument({
      file,
      name: "",
      folderId: "folder-1",
      category: "General",
    });
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect(body.get("name")).toBe("report.pdf");
    expect(body.has("description")).toBe(false);
    expect(body.has("tags")).toBe(false);
  });

  it("uploadBoardDocument throws when the response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
      )
    );
    const file = new File(["x"], "policy.pdf", { type: "application/pdf" });
    await expect(
      uploadBoardDocument({
        file,
        name: "P",
        folderId: "folder-1",
        category: "General",
      })
    ).rejects.toThrow();
  });

  it("uploadBoardDocumentVersion POSTs FormData to the upload-version URL", async () => {
    const file = new File(["x"], "v3.pdf", { type: "application/pdf" });
    await uploadBoardDocumentVersion({
      documentId: "doc-1",
      file,
      comment: "next cut",
    });
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:5000/api/v1/documents/doc-1/upload-version"
    );
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok-123");
    const body = init.body as FormData;
    expect(body.get("file")).toBe(file);
    expect(body.get("comment")).toBe("next cut");
  });

  it("uploadBoardDocumentVersion omits an empty comment + throws on a non-ok response", async () => {
    const file = new File(["x"], "v3.pdf", { type: "application/pdf" });
    await uploadBoardDocumentVersion({ documentId: "doc-1", file });
    const okMock = fetch as unknown as ReturnType<typeof vi.fn>;
    expect((okMock.mock.calls[0][1].body as FormData).has("comment")).toBe(
      false
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
      )
    );
    await expect(
      uploadBoardDocumentVersion({ documentId: "doc-1", file })
    ).rejects.toThrow();
  });
});
