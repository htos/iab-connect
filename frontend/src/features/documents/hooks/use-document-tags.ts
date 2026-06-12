"use client";

import { useQuery } from "@tanstack/react-query";
import { documentsKeys, fetchTags } from "../api/documents-api";

/**
 * Server state for the global tag filter list (E29-S2). The god-page loaded the
 * tags in parallel with the documents on every fetch; here it is its own query
 * (refetched independently). DEC-1=A wraps the shared service; we throw on
 * `!result.success` to drive TanStack rejection. `enabled` mirrors the page's
 * auth gate.
 */
export function useDocumentTags(enabled: boolean) {
  return useQuery({
    queryKey: documentsKeys.tags(),
    queryFn: async () => {
      const result = await fetchTags();
      if (!result.success) throw new Error(result.error ?? "Request failed");
      return result.data;
    },
    enabled,
  });
}
