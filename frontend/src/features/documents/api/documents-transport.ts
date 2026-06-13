/**
 * Document management transport (E31-S1, DEC-3 single owner). Relocated verbatim
 * off the retired `documents`. The shared types/enums/helpers live
 * in `@/types/documents`; the `ApiResult` HTTP base in `./documents-http`. The
 * `board-documents` + `admin-documents` sibling slices cross-import these fns with
 * an explicit `eslint-disable` (DEC-3 = A). REQ-034-037: Document Management.
 */

import { apiGet, apiPost, apiPut, apiDelete } from "./documents-http";
import type { ApiResult } from "@/types/api-result";
import type {
  CreateFolderRequest,
  DocumentDetailDto,
  DocumentDto,
  DocumentFolderDto,
  DocumentVersionDto,
  PagedDocumentsResult,
  SetFolderPermissionsRequest,
  UpdateDocumentRequest,
  UpdateFolderRequest,
} from "@/types/documents";

// Folders
export function getFolders(
  parentId?: string
): Promise<ApiResult<DocumentFolderDto[]>> {
  const params = parentId ? `?parentId=${parentId}` : "";
  return apiGet<DocumentFolderDto[]>(`/document-folders${params}`);
}

export function getFolderById(
  id: string
): Promise<ApiResult<DocumentFolderDto>> {
  return apiGet<DocumentFolderDto>(`/document-folders/${id}`);
}

export function createFolder(
  data: CreateFolderRequest
): Promise<ApiResult<DocumentFolderDto>> {
  return apiPost<DocumentFolderDto>("/document-folders", data);
}

export function updateFolder(
  id: string,
  data: UpdateFolderRequest
): Promise<ApiResult<unknown>> {
  return apiPut<unknown>(`/document-folders/${id}`, data);
}

export function deleteFolder(id: string): Promise<ApiResult<unknown>> {
  return apiDelete<unknown>(`/document-folders/${id}`);
}

export function setFolderPermissions(
  id: string,
  data: SetFolderPermissionsRequest
): Promise<ApiResult<unknown>> {
  return apiPut<unknown>(`/document-folders/${id}/permissions`, data);
}

// Documents
export function getDocuments(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  folderId?: string;
  category?: string;
  status?: string;
  tags?: string;
}): Promise<ApiResult<PagedDocumentsResult>> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set("page", params.page.toString());
  if (params.pageSize) searchParams.set("pageSize", params.pageSize.toString());
  if (params.search) searchParams.set("search", params.search);
  if (params.folderId) searchParams.set("folderId", params.folderId);
  if (params.category) searchParams.set("category", params.category);
  if (params.status) searchParams.set("status", params.status);
  if (params.tags) searchParams.set("tags", params.tags);
  return apiGet<PagedDocumentsResult>(`/documents?${searchParams.toString()}`);
}

export function getDocumentById(
  id: string
): Promise<ApiResult<DocumentDetailDto>> {
  return apiGet<DocumentDetailDto>(`/documents/${id}`);
}

export function updateDocument(
  id: string,
  data: UpdateDocumentRequest
): Promise<ApiResult<DocumentDto>> {
  return apiPut<DocumentDto>(`/documents/${id}`, data);
}

export function deleteDocument(id: string): Promise<ApiResult<unknown>> {
  return apiDelete<unknown>(`/documents/${id}`);
}

export function getDocumentVersions(
  id: string
): Promise<ApiResult<DocumentVersionDto[]>> {
  return apiGet<DocumentVersionDto[]>(`/documents/${id}/versions`);
}

export function reviewDocument(id: string): Promise<ApiResult<unknown>> {
  return apiPost<unknown>(`/documents/${id}/review`);
}

export function publishDocument(id: string): Promise<ApiResult<unknown>> {
  return apiPost<unknown>(`/documents/${id}/publish`);
}

export function archiveDocument(id: string): Promise<ApiResult<unknown>> {
  return apiPost<unknown>(`/documents/${id}/archive`);
}

export function restoreVersion(
  id: string,
  versionNumber: number
): Promise<ApiResult<DocumentVersionDto>> {
  return apiPost<DocumentVersionDto>(
    `/documents/${id}/versions/${versionNumber}/restore`
  );
}

export function getAllTags(): Promise<ApiResult<string[]>> {
  return apiGet<string[]>("/documents/tags");
}

export function updateDocumentTags(
  id: string,
  tags: string[]
): Promise<ApiResult<unknown>> {
  return apiPut<unknown>(`/documents/${id}/tags`, { tags });
}
