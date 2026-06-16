import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * E29-S2: the documents slice api owns the query-key factory and wraps the
 * shared `documents` transport (DEC-1 = A — no URL re-impl). These
 * assert the key shapes and that each wrapper delegates to the service with the
 * byte-identical params the god-page used: `page`/`pageSize` always; empty
 * `search`/`folderId`/`tags` omitted (sent as `undefined`); `tags` kept a single
 * STRING (never an array); `getFolders(parentId)` and the download-URL builder
 * forwarded verbatim.
 */

// Mock the shared transport — the api layer must delegate to it (DEC-1=A). The
// data fns live in the relocated transport; `getDownloadUrl` is a pure helper
// that now lives in `@/types/documents` (E31-S1), so it is mocked separately.
const serviceSpy = vi.hoisted(() => ({
  getDocuments: vi.fn(() =>
    Promise.resolve({ success: true, data: { items: [] } })
  ),
  getFolders: vi.fn(() => Promise.resolve({ success: true, data: [] })),
  getAllTags: vi.fn(() => Promise.resolve({ success: true, data: [] })),
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

import {
  DOCUMENTS_BASE,
  DOCUMENT_FOLDERS_BASE,
  DOCUMENT_TAGS_BASE,
  documentsKeys,
  fetchDocuments,
  fetchFolders,
  fetchTags,
  getDocumentDownloadUrl,
  type ListDocumentsFilters,
} from "./documents-api";

afterEach(() => {
  vi.clearAllMocks();
});

const baseFilters: ListDocumentsFilters = {
  page: 1,
  pageSize: 20,
};

describe("documents endpoint bases", () => {
  it("exposes the byte-identical /api/v1 bases", () => {
    expect(DOCUMENTS_BASE).toBe("/api/v1/documents");
    expect(DOCUMENT_FOLDERS_BASE).toBe("/api/v1/document-folders");
    expect(DOCUMENT_TAGS_BASE).toBe("/api/v1/documents/tags");
  });
});

describe("documentsKeys", () => {
  it("exposes the stable key shapes", () => {
    expect(documentsKeys.all).toEqual(["documents"]);
    expect(documentsKeys.tags()).toEqual(["documents", "tags"]);
    expect(documentsKeys.folders(undefined)).toEqual([
      "documents",
      "folders",
      null,
    ]);
    expect(documentsKeys.folders("folder-a")).toEqual([
      "documents",
      "folders",
      "folder-a",
    ]);
    expect(documentsKeys.list(baseFilters)).toEqual([
      "documents",
      "list",
      { page: 1, pageSize: 20 },
    ]);
  });

  it("includes every filter field in the list key (refetch-on-filter)", () => {
    expect(
      documentsKeys.list({
        page: 2,
        pageSize: 20,
        search: "report",
        folderId: "folder-a",
        tags: "finance",
      })
    ).toEqual([
      "documents",
      "list",
      {
        page: 2,
        pageSize: 20,
        search: "report",
        folderId: "folder-a",
        tags: "finance",
      },
    ]);
  });
});

describe("fetchDocuments (delegates to the shared service, params byte-identical)", () => {
  it("forwards page + pageSize and omits empty search/folderId/tags as undefined", () => {
    fetchDocuments(baseFilters);
    expect(serviceSpy.getDocuments).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      search: undefined,
      folderId: undefined,
      tags: undefined,
    });
  });

  it("forwards a single-tag STRING (never an array) + the other filters", () => {
    fetchDocuments({
      page: 3,
      pageSize: 20,
      search: "report",
      folderId: "folder-a",
      tags: "finance",
    });
    const args = (serviceSpy.getDocuments.mock.calls[0] as unknown[])[0] as {
      tags?: unknown;
    };
    expect(args).toMatchObject({
      page: 3,
      pageSize: 20,
      search: "report",
      folderId: "folder-a",
      tags: "finance",
    });
    expect(typeof args.tags).toBe("string");
    expect(Array.isArray(args.tags)).toBe(false);
  });

  it("treats empty-string filters as omitted (god-page parity)", () => {
    fetchDocuments({
      page: 1,
      pageSize: 20,
      search: "",
      folderId: "",
      tags: "",
    });
    expect(serviceSpy.getDocuments).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      search: undefined,
      folderId: undefined,
      tags: undefined,
    });
  });
});

describe("fetchFolders / fetchTags / getDocumentDownloadUrl", () => {
  it("fetchFolders forwards the parentId verbatim (undefined = root)", () => {
    fetchFolders();
    expect(serviceSpy.getFolders).toHaveBeenCalledWith(undefined);
    fetchFolders("folder-a");
    expect(serviceSpy.getFolders).toHaveBeenCalledWith("folder-a");
  });

  it("fetchTags delegates to the service tags endpoint", () => {
    fetchTags();
    expect(serviceSpy.getAllTags).toHaveBeenCalledTimes(1);
  });

  it("getDocumentDownloadUrl delegates to the service URL builder", () => {
    const url = getDocumentDownloadUrl("doc-1");
    expect(serviceSpy.getDownloadUrl).toHaveBeenCalledWith("doc-1");
    expect(url).toBe("http://localhost:5000/api/v1/documents/doc-1/download");
  });
});
