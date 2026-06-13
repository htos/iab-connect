"use client";

import { useQuery } from "@tanstack/react-query";
import {
  boardDocumentsKeys,
  fetchBoardDocuments,
  fetchBoardFolders,
  fetchBoardTags,
  type ListBoardDocumentsFilters,
} from "../api/board-documents-api";

/**
 * Board documents list server state (E29-S3, DEC-1 = A). The god-page does
 * SERVER-side search/status/category/folder filtering + pagination, so all
 * filters are part of the query key and TanStack refetches as any change.
 * The transport stays on `documents` (which returns
 * `ApiResult<T>`), so we throw on `!result.success` to drive TanStack rejection
 * (the suppliers/events/E29-S2 pattern → the `documents.loadError` banner).
 * `enabled` mirrors the page's `isAuthenticated && (isVorstand || isAdmin)`
 * gate so NO fetch fires before the user is authorised (AC-3).
 */
export function useBoardDocuments(
  filters: ListBoardDocumentsFilters,
  enabled: boolean
) {
  return useQuery({
    queryKey: boardDocumentsKeys.list(filters),
    queryFn: async () => {
      const result = await fetchBoardDocuments(filters);
      if (!result.success) throw new Error(result.error ?? "Request failed");
      return result.data;
    },
    enabled,
  });
}

/**
 * Folders under the navigated parent (E29-S3). Keyed by `parentId` (null at
 * root) so navigating refetches. A failure silently no-ops (god-page parity:
 * `if (result.success) setFolders(...)` with no error branch), so we return an
 * empty list on `!success` rather than throwing.
 */
export function useBoardFolders(
  parentId: string | undefined,
  enabled: boolean
) {
  return useQuery({
    queryKey: [...boardDocumentsKeys.all, "folders", parentId ?? null] as const,
    queryFn: async () => {
      const result = await fetchBoardFolders(parentId);
      return result.success ? result.data : [];
    },
    enabled,
  });
}

/**
 * Global tag list, loaded in parallel with the list on the god-page. A failure
 * silently no-ops (god-page parity), so we return an empty array on `!success`.
 */
export function useBoardTags(enabled: boolean) {
  return useQuery({
    queryKey: [...boardDocumentsKeys.all, "tags"] as const,
    queryFn: async () => {
      const result = await fetchBoardTags();
      return result.success ? result.data : [];
    },
    enabled,
  });
}
