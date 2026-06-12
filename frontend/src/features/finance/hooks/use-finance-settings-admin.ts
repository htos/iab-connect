"use client";

import { useMutation } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { settingsUrls } from "../api/settings-api";
import type { BackfillResult } from "../types/settings.types";

/**
 * The settings-hub operational panels (E26-S6): backfill-double-entry + finance reset. Both
 * mutationFns THROW the raw `res.error` string on failure, so the hub's `try/catch` can preserve
 * the god-page's distinct error semantics:
 *   - backfill error → the RAW res.error string (the god-page surfaces `err.message`).
 *   - reset error → the LOCALISED `settingsHub.resetFinanceError` (the hub maps the catch to a key).
 * The reset mutation dispatches the cross-page `finance-profile-changed` CustomEvent on SUCCESS
 * only (A56) — byte-identical to the god-page.
 */

export function useBackfillDoubleEntry() {
  const api = useApiClient();
  return useMutation<BackfillResult, Error, { cutOffDate: string | undefined }>(
    {
      mutationFn: async ({ cutOffDate }) => {
        const res = await api.post<BackfillResult>(
          settingsUrls.backfillDoubleEntry(),
          { cutOffDate }
        );
        if (res.error) throw new Error(res.error);
        return res.data as BackfillResult;
      },
    }
  );
}

export function useResetFinance() {
  const api = useApiClient();
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const res = await api.delete(settingsUrls.reset());
      if (res.error) throw new Error(res.error);
    },
    onSuccess: () => {
      window.dispatchEvent(new CustomEvent("finance-profile-changed"));
    },
  });
}
