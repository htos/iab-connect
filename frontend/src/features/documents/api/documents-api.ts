// Documents feature API (E29-S2). DEC-1 = A: this layer WRAPS the existing
// `@/lib/services/documents` transport (which itself wraps `lib/services/api.ts`
// `apiGet` with a dynamic `getSession()` token) rather than re-implementing the
// URLs against `useApiClient`. The board sibling (E29-S3) shares that service
// module, so we must NOT rewrite or divert the member-browse transport (A62).
// The slice owns the query-key factory; the request URLs/params stay
// byte-identical to the god-page (single-`tags` STRING, omitted-empty params,
// `pageSize` passed through by the caller).
import {
  getDocuments as serviceGetDocuments,
  getFolders as serviceGetFolders,
  getAllTags as serviceGetAllTags,
  getDownloadUrl as serviceGetDownloadUrl,
} from "@/lib/services/documents";
import type {
  DocumentFolderDto,
  PagedDocumentsResult,
} from "../types/document.types";

// Endpoint bases (E21-S1 rule 5: no raw `/api/v1/...` strings in components).
// The actual fetch is delegated to `@/lib/services/documents`, whose functions
// build these same paths; these consts document the slice's surface + back the
// `getDownloadUrl` re-export.
export const DOCUMENTS_BASE = "/api/v1/documents";
export const DOCUMENT_FOLDERS_BASE = "/api/v1/document-folders";
export const DOCUMENT_TAGS_BASE = "/api/v1/documents/tags";

/**
 * Server-side filter shape for the documents list (mirrors the god-page's
 * `getDocuments` params). `tags` is a single STRING (not an array) — the HEAD
 * invariant the board sibling shares; do not convert to multi-select. Empty
 * fields are omitted from the request by the underlying service.
 */
export interface ListDocumentsFilters {
  page: number;
  pageSize: number;
  search?: string;
  folderId?: string;
  tags?: string;
}

/**
 * Query-key + invalidation convention (E21-S1 server-state strategy). The
 * documents list does SERVER-side search/folder/tag filtering + pagination, so
 * `page`/`search`/`folderId`/`tags` are all part of the list key — TanStack
 * refetches as any change. `folders` is keyed by `parentId` (the navigated
 * folder); `tags` is global.
 */
export const documentsKeys = {
  all: ["documents"] as const,
  list: (filters: ListDocumentsFilters) =>
    ["documents", "list", { ...filters }] as const,
  folders: (parentId: string | undefined) =>
    ["documents", "folders", parentId ?? null] as const,
  tags: () => ["documents", "tags"] as const,
};

/**
 * List documents. Delegates to `@/lib/services/documents.getDocuments`,
 * forwarding the params byte-identically — `page`/`pageSize` always, and
 * `search`/`folderId`/`tags` only when truthy (the service omits empty params),
 * with `tags` kept as a single string.
 */
export function fetchDocuments(filters: ListDocumentsFilters) {
  return serviceGetDocuments({
    page: filters.page,
    pageSize: filters.pageSize,
    search: filters.search || undefined,
    folderId: filters.folderId || undefined,
    tags: filters.tags || undefined,
  });
}

/** List the folders under `parentId` (root when undefined) — `?parentId=` only when set. */
export function fetchFolders(parentId?: string) {
  return serviceGetFolders(parentId);
}

/** Fetch the global tag list for the filter dropdown. */
export function fetchTags() {
  return serviceGetAllTags();
}

/** Build the authenticated blob-download URL for a document (no request fired). */
export function getDocumentDownloadUrl(documentId: string): string {
  return serviceGetDownloadUrl(documentId);
}

export type { DocumentFolderDto, PagedDocumentsResult };
