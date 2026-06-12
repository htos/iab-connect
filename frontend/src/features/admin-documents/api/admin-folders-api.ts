// Admin folders feature API (E27-S6). DEC-1 = A: this layer WRAPS the existing
// `@/lib/services/documents` folder transport (each fn returns an
// `ApiResult<T> = { success, data, error? }` and resolves its own token via the
// service's `getSession()`) rather than re-implementing the URLs against
// `useApiClient`. The member `features/documents` slice (A62) SHARES that
// service module, so we must NOT rewrite or relocate it (a `features -> features`
// import is forbidden by E21-S5; moving it would break the member slice). The
// slice owns the query-key factory; request URLs/params stay byte-identical to
// the god-page.
import {
  getFolders as serviceGetFolders,
  createFolder as serviceCreateFolder,
  updateFolder as serviceUpdateFolder,
  deleteFolder as serviceDeleteFolder,
  setFolderPermissions as serviceSetFolderPermissions,
} from "@/lib/services/documents";
import type {
  CreateFolderRequest,
  UpdateFolderRequest,
  SetFolderPermissionsRequest,
} from "../types/admin-documents.types";

// Endpoint base (E21-S1 rule 5: no raw `/api/v1/...` strings in components). The
// actual fetch is delegated to `@/lib/services/documents`, whose functions build
// this same path; this const documents the slice's surface.
export const DOCUMENT_FOLDERS_BASE = "/api/v1/document-folders";

/**
 * Query-key + invalidation convention (E21-S1 server-state strategy). The folder
 * list is keyed by `parentId` (the navigated folder; undefined/root = null) so
 * drilling in/out refetches the children. Folder mutations invalidate the
 * `adminFoldersKeys.all` root, matching the god-page's `fetchFolders` re-load
 * after every create/update/delete/set-permissions.
 */
export const adminFoldersKeys = {
  all: ["admin-folders"] as const,
  list: (parentId: string | undefined) =>
    ["admin-folders", "list", parentId ?? null] as const,
};

/** List the folders under `parentId` (root when undefined). Delegates verbatim. */
export function fetchFolders(parentId?: string) {
  return serviceGetFolders(parentId);
}

/** Create a folder (optionally under a parent). Delegates verbatim. */
export function createFolder(data: CreateFolderRequest) {
  return serviceCreateFolder(data);
}

/** Rename/update a folder. Delegates verbatim. */
export function updateFolder(id: string, data: UpdateFolderRequest) {
  return serviceUpdateFolder(id, data);
}

/** Delete a folder. Delegates verbatim. */
export function deleteFolder(id: string) {
  return serviceDeleteFolder(id);
}

/** Replace a folder's role permissions. Delegates verbatim. */
export function setFolderPermissions(
  id: string,
  data: SetFolderPermissionsRequest
) {
  return serviceSetFolderPermissions(id, data);
}
