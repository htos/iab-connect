"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth, useApiClient } from "@/lib/auth";

export default function ExportsPage() {
  const t = useTranslations("finance");
  const router = useRouter();
  const { canReadFinance } = useAuth();
  const api = useApiClient();

  const apiRef = useRef(api);
  apiRef.current = api;
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

  const handleExportJournal = useCallback(async () => {
    try {
      setExportingJournal(true);
      setError(null);
      const res = await apiRef.current.get(
        `/api/v1/finance/exports/journal?from=${journalFrom}&to=${journalTo}`
      );
      if (res.error) throw new Error(res.error);
      const blob = res.data as Blob;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "journal.csv";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError(tRef.current("loadError"));
    } finally {
      setExportingJournal(false);
    }
  }, [journalFrom, journalTo]);

  const handleExportOpenItems = useCallback(async () => {
    try {
      setExportingOpenItems(true);
      setError(null);
      const res = await apiRef.current.get(
        "/api/v1/finance/exports/open-items"
      );
      if (res.error) throw new Error(res.error);
      const blob = res.data as Blob;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "open-items.csv";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError(tRef.current("loadError"));
    } finally {
      setExportingOpenItems(false);
    }
  }, []);

  if (!canReadFinance) return null;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
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
