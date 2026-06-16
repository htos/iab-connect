"use client";

import { useCallback } from "react";
import { useApiClient } from "@/lib/auth";
import { bankingUrls } from "../api/banking-api";

// Exports blob-download helpers (E26-S5). IMPERATIVE side-effect functions (NOT queries):
// each GETs a CSV blob, creates an object URL, triggers an anchor download with a
// HARDCODED filename, then revokes. The exports anchor is NEVER DOM-appended (contrast
// the transactions receipt download). The JOURNAL query is STRING-INTERPOLATED in the
// api layer (NOT URLSearchParams) — pinned.

/** Shared blob → object-URL → non-appended anchor → click → revoke (exports style). */
async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

/**
 * Journal + open-items CSV exports. Each returns an async fn the content calls from its
 * button handler (managing its own `exporting`/`error` flags + the `loadError` i18n key
 * on failure, byte-identical to the god-page). The journal export interpolates from/to
 * directly into the URL.
 */
export function useExportDownloads() {
  const api = useApiClient();

  const exportJournal = useCallback(
    async (from: string, to: string) => {
      const res = await api.get(bankingUrls.exportsJournal(from, to));
      if (res.error) throw new Error(res.error);
      await downloadBlob(res.data as Blob, "journal.csv");
    },
    [api]
  );

  const exportOpenItems = useCallback(async () => {
    const res = await api.get(bankingUrls.exportsOpenItems());
    if (res.error) throw new Error(res.error);
    await downloadBlob(res.data as Blob, "open-items.csv");
  }, [api]);

  return { exportJournal, exportOpenItems };
}
