"use client";

import { useEffect, useState } from "react";
import { useApiClient } from "@/lib/auth";
import { financeUrls } from "../api/finance-api";

/**
 * DoubleEntry mode guard (ledger-accounts / journal-entries / accounting-reports /
 * posting-mappings). This is AUTH/MODE ROUTING, not data — so it stays an imperative
 * effect exactly as the god-pages had it (A97/AC-1): GET `/api/v1/finance/profile`;
 * `router.replace("/finance/settings")` unless `accountingMode === "DoubleEntry"`; the
 * resource fetch waits on `modeChecked`. A rejected profile GET also redirects.
 *
 * The caller passes its own `router.replace` (the four pages all redirect to
 * `/finance/settings`). `useApiClient` is `useMemo`-stable, so the effect deps
 * `[api, replace]` keep it running once on mount, not on every render.
 */
export function useDoubleEntryGuard(replace: (href: string) => void): boolean {
  const api = useApiClient();
  const [modeChecked, setModeChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(financeUrls.profile());
        if (
          !cancelled &&
          (!res.data ||
            (res.data as { accountingMode?: string }).accountingMode !==
              "DoubleEntry")
        ) {
          replace("/finance/settings");
          return;
        }
      } catch {
        if (!cancelled) replace("/finance/settings");
        return;
      }
      if (!cancelled) setModeChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [api, replace]);

  return modeChecked;
}
