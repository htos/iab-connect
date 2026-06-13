"use client";

import { useQuery } from "@tanstack/react-query";
import { documentsKeys, fetchFolders } from "../api/documents-api";

/**
 * Server state for the folder grid (E29-S2). Keyed by `parentId` — the folder
 * the user has navigated into (undefined = root) — so navigating refetches the
 * children. DEC-1=A wraps the shared service; we throw on `!result.success` to
 * drive TanStack rejection. `enabled` mirrors the page's auth gate.
 */
export function useDocumentFolders(
  parentId: string | undefined,
  enabled: boolean
) {
  return useQuery({
    queryKey: documentsKeys.folders(parentId),
    queryFn: async () => {
      const result = await fetchFolders(parentId);
      if (!result.success) throw new Error(result.error ?? "Request failed");
      return result.data;
    },
    enabled,
  });
}
