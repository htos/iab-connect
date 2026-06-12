// Board-documents feature API (E29-S3). DEC-1 = A: this layer WRAPS the existing
// `@/lib/services/documents` transport (which itself wraps `lib/services/api.ts`
// `apiGet`/`apiPost`/`apiPut`/`apiDelete` with a dynamic `getSession()` token)
// rather than re-implementing the URLs against `useApiClient`. The member-browse
// sibling (E29-S2) shares that service module, so we must NOT rewrite or divert
// it (A62). The slice owns a DISTINCT `boardDocumentsKeys` factory rooted at
// `["board-documents"]` (the S2 slice owns `documentsKeys` rooted at
// `["documents"]` — no collision).
//
// The upload + version-upload paths use raw `fetch` + `FormData` + a dynamic
// `next-auth/react getSession()` Bearer token today (the service module's
// `apiPost` only carries a JSON body, never `FormData`). DEC-1 = A keeps that
// EXACT shape, relocated here as plain functions, so the god-page's
// FormData field set / URL / token are byte-identical. The blob-download URL
// is delegated to the service builder; the token-at-click fetch lives in the
// `use-board-document-download` hook.
import {
  getDocuments as serviceGetDocuments,
  getFolders as serviceGetFolders,
  getAllTags as serviceGetAllTags,
  getDocumentById as serviceGetDocumentById,
  reviewDocument as serviceReviewDocument,
  publishDocument as servicePublishDocument,
  archiveDocument as serviceArchiveDocument,
  deleteDocument as serviceDeleteDocument,
  updateDocumentTags as serviceUpdateDocumentTags,
  restoreVersion as serviceRestoreVersion,
  getDownloadUrl as serviceGetDownloadUrl,
} from "@/lib/services/documents";
import type {
  DocumentFolderDto,
  PagedDocumentsResult,
} from "../types/board-document.types";

// Endpoint bases (E21-S1 rule 5: no raw `/api/v1/...` strings in components).
// The actual fetch is delegated to `@/lib/services/documents` (whose functions
// build these same paths) for the JSON endpoints; these consts document the
// slice's surface and back the raw-fetch upload/version-upload paths below.
export const DOCUMENTS_BASE = "/api/v1/documents";
export const DOCUMENT_FOLDERS_BASE = "/api/v1/document-folders";

/**
 * Server-side filter shape for the board documents list (mirrors the god-page's
 * `getDocuments` params). `page`/`pageSize` always present; `search`/`status`/
 * `category`/`folderId` only when truthy (the underlying service omits empty
 * params). Each filter change resets `page → 1` in the page content.
 */
export interface ListBoardDocumentsFilters {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  category?: string;
  folderId?: string;
}

/**
 * Query-key + invalidation convention (E21-S1 server-state strategy). The board
 * documents list does SERVER-side search/status/category/folder filtering +
 * pagination, so every filter field is part of the list key — TanStack refetches
 * as any change. Rooted at `["board-documents"]` so a mutation's
 * `invalidateQueries({ queryKey: boardDocumentsKeys.all })` refetches the list,
 * and `detail(id)` refetches a single document after a status/tag/restore/
 * version-upload mutation.
 */
export const boardDocumentsKeys = {
  all: ["board-documents"] as const,
  list: (filters: ListBoardDocumentsFilters) =>
    ["board-documents", "list", { ...filters }] as const,
  detail: (id: string) => ["board-documents", "detail", id] as const,
};

// --- List + read (delegate to the shared service, params byte-identical) ---

/**
 * List documents for the board surface. Forwards the god-page params verbatim —
 * `page`/`pageSize` always, and `search`/`status`/`category`/`folderId` only
 * when truthy (the service omits empty params).
 */
export function fetchBoardDocuments(filters: ListBoardDocumentsFilters) {
  return serviceGetDocuments({
    page: filters.page,
    pageSize: filters.pageSize,
    search: filters.search || undefined,
    folderId: filters.folderId || undefined,
    status: filters.status || undefined,
    category: filters.category || undefined,
  });
}

/** List the folders under `parentId` (root when undefined) — `?parentId=` only when set. */
export function fetchBoardFolders(parentId?: string) {
  return serviceGetFolders(parentId);
}

/** Fetch the global tag list (parallel to the list load on the god-page). */
export function fetchBoardTags() {
  return serviceGetAllTags();
}

/** Fetch a single document detail (versions included) by id. */
export function getBoardDocument(id: string) {
  return serviceGetDocumentById(id);
}

// --- Status workflow + delete + tags + restore (JSON, delegate verbatim) ---

export function reviewBoardDocument(id: string) {
  return serviceReviewDocument(id);
}

export function publishBoardDocument(id: string) {
  return servicePublishDocument(id);
}

export function archiveBoardDocument(id: string) {
  return serviceArchiveDocument(id);
}

export function deleteBoardDocument(id: string) {
  return serviceDeleteDocument(id);
}

/** PUT the tag array — byte-identical body `{ tags }` (service builds it). */
export function updateBoardDocumentTags(id: string, tags: string[]) {
  return serviceUpdateDocumentTags(id, tags);
}

export function restoreBoardDocumentVersion(id: string, versionNumber: number) {
  return serviceRestoreVersion(id, versionNumber);
}

/** Build the authenticated blob-download URL (no request fired). */
export function getBoardDocumentDownloadUrl(
  documentId: string,
  versionNumber?: number
): string {
  return serviceGetDownloadUrl(documentId, versionNumber);
}

// --- FormData uploads (raw fetch + dynamic getSession Bearer token) ---
// These keep the god-page's EXACT shape (DEC-1 = A): the service `apiPost`
// cannot carry a `FormData` body, so the upload stays a raw `fetch`. The token
// is read at call-time via a dynamic `next-auth/react` import.

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
}

async function authHeader(): Promise<{ Authorization: string }> {
  const { getSession } = await import("next-auth/react");
  const session = (await getSession()) as { accessToken?: string } | null;
  return { Authorization: `Bearer ${session?.accessToken || ""}` };
}

/** Metadata for a new-document upload (the upload-modal form values). */
export interface UploadBoardDocumentInput {
  file: File;
  name: string;
  folderId: string;
  category: string;
  description?: string;
  tags?: string;
}

/**
 * Upload a NEW document via multipart `FormData` to `POST /api/v1/documents`.
 * Field set byte-identical to the god-page: file / name / folderId / category /
 * (description) / (tags). Throws on a non-OK response so the mutation rejects.
 */
export async function uploadBoardDocument(
  input: UploadBoardDocumentInput
): Promise<void> {
  const formData = new FormData();
  formData.append("file", input.file);
  formData.append("name", input.name || input.file.name);
  formData.append("folderId", input.folderId);
  formData.append("category", input.category);
  if (input.description) formData.append("description", input.description);
  if (input.tags) formData.append("tags", input.tags);

  const response = await fetch(`${apiBaseUrl()}/api/v1/documents`, {
    method: "POST",
    headers: await authHeader(),
    body: formData,
  });
  if (!response.ok) throw new Error("Upload failed");
}

/** Inputs for a new-version upload (the version-upload-modal form values). */
export interface UploadBoardDocumentVersionInput {
  documentId: string;
  file: File;
  comment?: string;
}

/**
 * Upload a NEW VERSION via multipart `FormData` to
 * `POST /api/v1/documents/{id}/upload-version`. Field set byte-identical:
 * file / (comment). Throws on a non-OK response so the mutation rejects.
 */
export async function uploadBoardDocumentVersion(
  input: UploadBoardDocumentVersionInput
): Promise<void> {
  const formData = new FormData();
  formData.append("file", input.file);
  if (input.comment) formData.append("comment", input.comment);

  const response = await fetch(
    `${apiBaseUrl()}/api/v1/documents/${input.documentId}/upload-version`,
    {
      method: "POST",
      headers: await authHeader(),
      body: formData,
    }
  );
  if (!response.ok) throw new Error("Upload failed");
}

export type { DocumentFolderDto, PagedDocumentsResult };
