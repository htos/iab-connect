"use client";

import { useQuery } from "@tanstack/react-query";
import { adminFoldersKeys, fetchFolders } from "../api/admin-folders-api";

/**
 * Server state for the admin folder list (E27-S6), keyed by `parentId` (the
 * folder navigated into; undefined = root) so drilling in/out refetches the
 * children. DEC-1=A wraps the shared `@/lib/services/documents` service; we
 * throw on `!result.success` to drive TanStack rejection. `enabled` mirrors the
 * page's `isAuthenticated && isAdmin` gate.
 *
 * NOTE (A79): the `admin-folders-page-content` composition root preserves the
 * god-page's imperative list+subfolder-count orchestration (a `Promise.all` of
 * per-folder count probes + success/error banners + the close-before-await
 * delete) pinned VERBATIM by the E27-S1 net, rather than this single query — so
 * this hook is the documented slice surface (and is unit-tested) used by callers
 * that need the plain list without the count probe.
 */
export function useFolders(parentId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: adminFoldersKeys.list(parentId),
    queryFn: async () => {
      const result = await fetchFolders(parentId);
      if (!result.success) throw new Error(result.error ?? "Request failed");
      return result.data;
    },
    enabled,
  });
}
