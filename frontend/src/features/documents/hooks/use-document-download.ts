"use client";

import { useCallback } from "react";
import { getDocumentDownloadUrl } from "../api/documents-api";
import type { DocumentDto } from "../types/document.types";

/**
 * Authenticated blob-download side-effect (E29-S2, DEC-2 = A).
 *
 * A document download is a deterministic, user-initiated side-effect — NOT
 * server state — so it lives in a side-effect hook behind the download button
 * rather than a TanStack query/mutation cache entry. The implementation is the
 * god-page's `handleDownload` verbatim: build the download URL, read the access
 * token at click-time via a dynamic `next-auth/react getSession()` import,
 * `fetch` the blob with a Bearer header, then trigger a transient object-URL
 * `<a download>` and revoke it.
 *
 * The error is SURFACED to the caller (A76) — the hook does NOT own the error
 * banner. `download()` resolves to `null` on success or the caught error on
 * failure, so `documents-page-content` can set the page-level error banner
 * exactly as the god-page did (`setError(t("documents.downloadError"))`).
 */
export function useDocumentDownload() {
  const download = useCallback(
    async (doc: DocumentDto): Promise<Error | null> => {
      const url = getDocumentDownloadUrl(doc.id);
      try {
        const { getSession } = await import("next-auth/react");
        const session = (await getSession()) as {
          accessToken?: string;
        } | null;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${session?.accessToken || ""}` },
        });
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = window.document.createElement("a");
        link.href = objectUrl;
        link.setAttribute("download", doc.name);
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
        return null;
      } catch (error) {
        return error instanceof Error ? error : new Error("Download failed");
      }
    },
    []
  );

  return { download };
}
