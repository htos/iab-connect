"use client";

import { useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { bankingKeys, bankingUrls } from "../api/banking-api";
import type { Receipt } from "../types/banking.types";

// Receipts consumed by the TRANSACTIONS page (E26-S5). The receipts PAGE itself is S3;
// here only the attach-modal's pick-existing list, the receipt UPLOAD, and the imperative
// view/download helper. Distinct file (not S3's `use-receipts.ts`) to stay parallel-safe;
// the GET URL/key (`/api/v1/finance/receipts`, `["finance","receipts"]`) is the shared
// resource, so the two slices cache-share rather than conflict.

/**
 * Receipt list for the attach-modal's "pick existing" select. The god-page fetches on
 * modal open; the content drives `enabled` from the modal-open state. Swallows errors
 * (the god-page only sets state on `res.data`, never surfacing a lookup error).
 */
export function useReceiptsForAttach(enabled: boolean) {
  const api = useApiClient();
  return useQuery<Receipt[]>({
    queryKey: bankingKeys.receipts(),
    enabled,
    queryFn: async () => {
      const res = await api.get<{ items: Receipt[] }>(bankingUrls.receipts());
      const body = res.data as { items?: Receipt[] } | null;
      return body?.items ?? [];
    },
  });
}

/**
 * Receipt UPLOAD (multipart). `api.upload("/api/v1/finance/receipts", FormData{file,notes})`
 * — field `"file"` AND `"notes"`, Content-Type omitted (NOT JSON-ified). Returns the
 * `{ data }` so the caller reads the new receipt id and links it (the god-page's
 * `handleAttachReceipt` upload-then-link flow). The god-page surfaces the upload error
 * on `res.error` (it does NOT swallow), so the mutationFn returns the result for the
 * content to branch on.
 */
export function useUploadTransactionReceipt() {
  const api = useApiClient();
  return useMutation({
    mutationFn: async (vars: { file: File; notes: string }) => {
      const formData = new FormData();
      formData.append("file", vars.file);
      formData.append("notes", vars.notes);
      return api.upload<Receipt>(bankingUrls.receipts(), formData);
    },
  });
}

/**
 * Imperative receipt download/preview helper (NOT a query). Mirrors the god-page
 * `handleViewReceipt` byte-for-byte:
 *   1. GET .../receipts/{id} (info) → `contentType` + `fileName` (fallback "receipt").
 *   2. GET .../receipts/{id}/download (blob) → `URL.createObjectURL`.
 *   3a. image/* OR application/pdf → `onPreview({url,type,name})` (the content opens the
 *       preview modal; revoke DEFERRED to modal close).
 *   3b. otherwise → anchor download=<fileName>, APPENDED to body + click + REMOVED +
 *       immediate `URL.revokeObjectURL`.
 * (Contrast the exports download whose anchor is NOT appended.)
 */
export function useViewReceipt(
  onPreview: (preview: { url: string; type: string; name: string }) => void,
  onError: (message: string) => void
) {
  const api = useApiClient();
  return useCallback(
    async (receiptId: string) => {
      try {
        const infoRes = await api.get<Receipt>(bankingUrls.receipt(receiptId));
        const receipt = infoRes.data as Receipt | null;
        const contentType = receipt?.contentType ?? "";
        const fileName = receipt?.fileName ?? "receipt";

        const res = await api.get<Blob>(bankingUrls.receiptDownload(receiptId));
        if (res.error || !res.data) return;
        const blob = res.data as Blob;
        const url = URL.createObjectURL(blob);

        if (
          contentType.startsWith("image/") ||
          contentType === "application/pdf"
        ) {
          onPreview({ url, type: contentType, name: fileName });
        } else {
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      } catch {
        onError("Failed to load receipt");
      }
    },
    [api, onPreview, onError]
  );
}
