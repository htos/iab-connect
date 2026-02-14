/**
 * REQ-034-037: Document Management Service
 * Types and API functions for document management
 */

import { apiGet, apiPost, apiPut, apiDelete, type ApiResult } from "./api";

// Enums matching backend (PascalCase)
export enum DocumentStatus {
  Draft = "Draft",
  Reviewed = "Reviewed",
  Published = "Published",
  Archived = "Archived",
}

export enum DocumentCategory {
  General = "General",
  Protocol = "Protocol",
  Contract = "Contract",
  Invoice = "Invoice",
  Regulation = "Regulation",
  Template = "Template",
  Report = "Report",
  Photo = "Photo",
  Presentation = "Presentation",
  Other = "Other",
}

export enum DocumentAccessRole {
  Member = "Member",
  Vorstand = "Vorstand",
  Admin = "Admin",
}

export enum DocumentPermissionType {
  Read = "Read",
  Write = "Write",
  Manage = "Manage",
}

// DTOs
export interface DocumentFolderDto {
  id: string;
  name: string;
  description?: string;
  parentFolderId?: string;
  sortOrder: number;
  permissions: FolderPermissionDto[];
  createdAt: string;
}

export interface FolderPermissionDto {
  role: string;
  permissionType: string;
}

export interface DocumentDto {
  id: string;
  name: string;
  description?: string;
  category: string;
  status: string;
  folderId: string;
  contentType: string;
  fileSize: number;
  tags: string[];
  expiresAt?: string;
  createdAt: string;
  createdBy?: string;
}

export interface DocumentDetailDto extends DocumentDto {
  reviewedBy?: string;
  reviewedAt?: string;
  publishedBy?: string;
  publishedAt?: string;
  versions: DocumentVersionDto[];
}

export interface DocumentVersionDto {
  id: string;
  versionNumber: number;
  fileSize: number;
  contentType: string;
  comment?: string;
  uploadedAt: string;
}

export interface PagedDocumentsResult {
  items: DocumentDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Request types
export interface CreateFolderRequest {
  name: string;
  description?: string;
  parentFolderId?: string;
  sortOrder?: number;
}

export interface UpdateFolderRequest {
  name: string;
  description?: string;
  sortOrder?: number;
}

export interface SetFolderPermissionsRequest {
  permissions: PermissionEntry[];
}

export interface PermissionEntry {
  role: string;
  permissionType: string;
}

export interface UpdateDocumentRequest {
  name: string;
  category?: string;
  description?: string;
  expiresAt?: string;
  tags?: string[];
}

export interface UpdateTagsRequest {
  tags: string[];
}

// API Functions

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

// Helper: format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// Helper: get status color
export function getStatusColor(status: string): string {
  switch (status) {
    case DocumentStatus.Draft:
      return "bg-gray-100 text-gray-800";
    case DocumentStatus.Reviewed:
      return "bg-blue-100 text-blue-800";
    case DocumentStatus.Published:
      return "bg-green-100 text-green-800";
    case DocumentStatus.Archived:
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

// Helper: get category label
export function getCategoryLabel(category: string): string {
  return category;
}

// Helper: download URL
export function getDownloadUrl(
  documentId: string,
  versionNumber?: number
): string {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  if (versionNumber) {
    return `${base}/api/v1/documents/${documentId}/versions/${versionNumber}/download`;
  }
  return `${base}/api/v1/documents/${documentId}/download`;
}
