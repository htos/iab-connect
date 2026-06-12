"use client";

import { useQuery } from "@tanstack/react-query";
import {
  documentsKeys,
  fetchDocuments,
  type ListDocumentsFilters,
} from "../api/documents-api";

/**
 * Server state for the documents list (E29-S2). The god-page does SERVER-side
 * search/folder/tag filtering + pagination, so all filters are part of the
 * query key and TanStack refetches as any change. DEC-1=A keeps the transport
 * on `@/lib/services/documents` (which returns `ApiResult<T>`), so we throw on
 * `!result.success`/`result.error` to drive TanStack rejection (the suppliers/
 * events pattern). `enabled` mirrors the page's auth gate so no fetch fires
 * before the user is authenticated.
 */
export function useDocuments(filters: ListDocumentsFilters, enabled: boolean) {
  return useQuery({
    queryKey: documentsKeys.list(filters),
    queryFn: async () => {
      const result = await fetchDocuments(filters);
      if (!result.success) throw new Error(result.error ?? "Request failed");
      return result.data;
    },
    enabled,
  });
}
