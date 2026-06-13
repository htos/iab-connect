/**
 * Shared document types/enums + pure presentation helpers (E31-S1, DEC-2).
 * Relocated verbatim off the retired `documents`. Lives in
 * `@/types` (a lib-leaf, import-legal from any feature) because these symbols are
 * consumed by the `documents`, `board-documents`, and `admin-documents` slices; a
 * feature-owned home would force cross-feature imports (E21-S5). The document
 * TRANSPORT fns live in `features/documents/api/documents-transport.ts` (the DEC-3
 * single owner). REQ-034-037: Document Management.
 */

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
