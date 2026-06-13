"use client";

/**
 * Finance Exports content (E26-S5 migration of `app/finance/exports/page.tsx`).
 * Composition root (only `"use client"`) — self-embeds its own `QueryClientProvider`.
 *
 * Read-only LEAN guard (canReadFinance-ONLY; `router.replace("/")`; `return null`; NO
 * isLoading wait — the premature-redirect-on-cold-session quirk preserved AS-IS). The
 * two CSV exports stream a blob via the `useExportDownloads` imperative helper:
 * object-URL → anchor download=<hardcoded filename> → click → revoke, anchor NOT
 * DOM-appended; the journal query is STRING-INTERPOLATED (in the api layer). On failure
 * the page surfaces the `loadError` i18n key. Every i18n key + URL byte-identical.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useExportDownloads } from "../../hooks/use-exports";

function ExportsBody() {
  const t = useTranslations("finance");
  const router = useRouter();
  const { canReadFinance } = useAuth();
  const { exportJournal, exportOpenItems } = useExportDownloads();

  const tRef = useRef(t);
  tRef.current = t;

  const [journalFrom, setJournalFrom] = useState(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]
  );
  const [journalTo, setJournalTo] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [exportingJournal, setExportingJournal] = useState(false);
  const [exportingOpenItems, setExportingOpenItems] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canReadFinance) {
      router.replace("/");
    }
  }, [canReadFinance, router]);

  const handleExportJournal = async () => {
    try {
      setExportingJournal(true);
      setError(null);
      await exportJournal(journalFrom, journalTo);
    } catch {
      setError(tRef.current("loadError"));
    } finally {
      setExportingJournal(false);
    }
  };

  const handleExportOpenItems = async () => {
    try {
      setExportingOpenItems(true);
      setError(null);
      await exportOpenItems();
    } catch {
      setError(tRef.current("loadError"));
    } finally {
      setExportingOpenItems(false);
    }
  };

  if (!canReadFinance) return null;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Back to Settings */}
        <Link
          href="/finance/settings"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {t("backToSettings")}
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{t("exports")}</h1>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        )}

        {/* Export Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Journal Export Card */}
          <div className="space-y-4 rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900">
              {t("journalExport")}
            </h2>
            <p className="text-sm text-gray-600">
              {t("journalExportDescription")}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("from")}
                </label>
                <input
                  type="date"
                  value={journalFrom}
                  onChange={(e) => setJournalFrom(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("to")}
                </label>
                <input
                  type="date"
                  value={journalTo}
                  onChange={(e) => setJournalTo(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              onClick={handleExportJournal}
              disabled={exportingJournal}
              className="w-full rounded-lg bg-orange-600 px-4 py-2 font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
            >
              {exportingJournal ? t("exporting") : t("exportJournal")}
            </button>
          </div>

          {/* Open Items Export Card */}
          <div className="space-y-4 rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900">
              {t("openItemsExport")}
            </h2>
            <p className="text-sm text-gray-600">
              {t("openItemsExportDescription")}
            </p>

            <div className="flex-1" />

            <button
              onClick={handleExportOpenItems}
              disabled={exportingOpenItems}
              className="w-full rounded-lg bg-orange-600 px-4 py-2 font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
            >
              {exportingOpenItems ? t("exporting") : t("exportOpenItems")}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

export function ExportsContent() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <ExportsBody />
    </QueryClientProvider>
  );
}
