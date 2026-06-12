"use client";

import { useQuery } from "@tanstack/react-query";
import {
  boardDocumentsKeys,
  getBoardDocument,
} from "../api/board-documents-api";

/**
 * Sentinel error so the detail component can distinguish a 404 (the dedicated
 * not-found view) from a generic failure, mirroring `SponsorNotFoundError` /
 * `EventNotFoundError` (A79). On the god-page BOTH branches rendered the same
 * `documents.notFound` not-found view (because `document` stayed null), so the
 * component treats `isError` uniformly as the not-found view (AC-8) — this class
 * exists for parity with the detail-slice recipe + future divergence.
 */
export class BoardDocumentNotFoundError extends Error {
  constructor() {
    super("documents.notFound");
    this.name = "BoardDocumentNotFoundError";
  }
}

/**
 * Board document detail server state (E29-S3, DEC-1 = A). The transport stays on
 * `@/lib/services/documents.getDocumentById` (an `ApiResult<T>`); a 404 throws
 * `BoardDocumentNotFoundError`, any other failure throws a generic Error. The
 * component renders `documents.notFound` whenever the query is in error and has
 * no data — the god-page's "document is null → not-found view" behaviour (the
 * hardcoded English fallback string is removed, AC-8). `enabled` mirrors the
 * `isAuthenticated && (isVorstand || isAdmin)` gate (AC-3) so no GET fires for
 * unauthorised users.
 */
export function useBoardDocument(id: string, enabled: boolean) {
  return useQuery({
    queryKey: boardDocumentsKeys.detail(id),
    queryFn: async () => {
      const result = await getBoardDocument(id);
      if (result.success) return result.data;
      if (result.status === 404) throw new BoardDocumentNotFoundError();
      throw new Error(result.error ?? "documents.notFound");
    },
    enabled: enabled && !!id,
    // A 404 is deterministic — skip the provider's `retry: 1` so the not-found
    // view renders immediately (god-page parity: it set `document = null` on the
    // first failed GET, no second fetch). Other errors keep the default retry.
    retry: (failureCount, error) =>
      !(error instanceof BoardDocumentNotFoundError) && failureCount < 1,
  });
}
