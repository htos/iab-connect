"use client";

/**
 * Bank Import content (E26-S5 migration of `app/finance/bank-import/page.tsx`).
 * Composition root (only `"use client"`) — self-embeds its own `QueryClientProvider`.
 *
 * Guard: INLINE "Not authorized" div (role ONLY; NO redirect, NO `return null`) — pinned
 * AS-IS. Single-shot upload (no wizard); the camt upload auto-triggers on file select.
 * The POST-vs-PUT `/ignore` divergence is preserved via two hooks (useIgnoreItem = POST,
 * useUnmatchItem = PUT). Upload uses `api.upload` (multipart, field "file", Content-Type
 * omitted); A92 the file input resets from the mutation `onSuccess` (the error path keeps
 * the selected file). The hardcoded-English upload/error strings are preserved VERBATIM
 * (NOT translated). A86: accept=green, reject=red, match/primary=orange.
 */

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { formatCHF } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import {
  useAcceptMatch,
  useBankImportDetail,
  useBankImports,
  useIgnoreItem,
  useMatchItem,
  useRejectMatch,
  useUnmatchItem,
  useUploadBankImport,
  useUploadCamt,
} from "../../hooks/use-bank-imports";
import type { BankImportItem } from "../../types/banking.types";

function BankImportBody() {
  const t = useTranslations("finance");
  const { canReadFinance, canWriteFinance } = useAuth();

  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const camtInputRef = useRef<HTMLInputElement>(null);

  // Detail view — local "which import is open" state drives the detail query.
  const [viewingImportId, setViewingImportId] = useState<string | null>(null);

  // Match modal
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchingItem, setMatchingItem] = useState<BankImportItem | null>(null);
  const [matchPaymentId, setMatchPaymentId] = useState("");

  const importsQuery = useBankImports(canReadFinance);
  const imports = importsQuery.data ?? [];
  const loading = canReadFinance && importsQuery.isLoading;
  const loadError = importsQuery.isError ? "Failed to load bank imports" : null;

  const detailQuery = useBankImportDetail(viewingImportId);
  const viewingImport = detailQuery.data ?? null;
  const detailLoading = !!viewingImportId && detailQuery.isLoading;

  const uploadImport = useUploadBankImport();
  const uploadCamt = useUploadCamt();
  const acceptMatch = useAcceptMatch();
  const rejectMatch = useRejectMatch();
  const matchItem = useMatchItem();
  const ignoreItem = useIgnoreItem();
  const unmatchItem = useUnmatchItem();

  const uploading = uploadImport.isPending;
  const uploadingCamt = uploadCamt.isPending;
  const matchSubmitting = matchItem.isPending;

  // The displayed banner = the action-triggered error OR the hardcoded list-load error
  // (pinned verbatim, NOT an i18n key) — derived, no effect (accounts-content precedent).
  const banner = error ?? loadError;

  const handleUpload = () => {
    if (!selectedFile) return;
    setError(null);
    uploadImport.mutate(selectedFile, {
      // A92: reset the file input ONLY on success (error path keeps the file).
      onSuccess: () => {
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
      onError: () => setError("Failed to upload file"),
    });
  };

  const handleCamtUpload = (file: File) => {
    setError(null);
    uploadCamt.mutate(file, {
      onSuccess: () => {
        if (camtInputRef.current) camtInputRef.current.value = "";
      },
      onError: () => setError("Failed to import camt file"),
    });
  };

  const handleAcceptMatch = (
    importId: string,
    itemId: string,
    invoiceId: string
  ) => {
    acceptMatch.mutate(
      { importId, itemId, invoiceId },
      { onError: () => setError("Failed to accept match") }
    );
  };

  const handleRejectMatch = (importId: string, itemId: string) => {
    rejectMatch.mutate(
      { importId, itemId },
      { onError: () => setError("Failed to reject match") }
    );
  };

  const openMatchModal = (item: BankImportItem) => {
    setMatchingItem(item);
    setMatchPaymentId("");
    setShowMatchModal(true);
  };

  const handleMatch = () => {
    if (!matchingItem || !viewingImportId) return;
    matchItem.mutate(
      {
        importId: viewingImportId,
        itemId: matchingItem.id,
        paymentId: matchPaymentId,
      },
      {
        onSuccess: () => setShowMatchModal(false),
        onError: () => setError("Failed to match item"),
      }
    );
  };

  // handleIgnore = POST, handleUnmatch = PUT — SAME path, preserved (DEC-2 = A).
  const handleIgnore = (importId: string, itemId: string) => {
    ignoreItem.mutate(
      { importId, itemId },
      { onError: () => setError("Failed to ignore item") }
    );
  };

  const handleUnmatch = (importId: string, itemId: string) => {
    unmatchItem.mutate(
      { importId, itemId },
      { onError: () => setError("Failed to unmatch item") }
    );
  };

  const filteredImports = imports.filter((imp) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      imp.fileName?.toLowerCase().includes(term) ||
      imp.status?.toLowerCase().includes(term) ||
      new Date(imp.importDate).toLocaleDateString("de-CH").includes(term) ||
      String(imp.itemCount).includes(term)
    );
  });

  const statusBadge = (status: string) => {
    const map: Record<string, { cls: string; label: () => string }> = {
      Pending: {
        cls: "bg-yellow-100 text-yellow-800",
        label: () => t("pending"),
      },
      Processed: {
        cls: "bg-green-100 text-green-800",
        label: () => t("processed"),
      },
      Unmatched: {
        cls: "bg-yellow-100 text-yellow-800",
        label: () => t("unmatched"),
      },
      Matched: {
        cls: "bg-green-100 text-green-800",
        label: () => t("matched"),
      },
      Ignored: {
        cls: "bg-gray-100 text-gray-600",
        label: () => t("ignored"),
      },
    };
    const entry = map[status] ?? {
      cls: "bg-gray-100 text-gray-600",
      label: () => status,
    };
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${entry.cls}`}
      >
        {entry.label()}
      </span>
    );
  };

  const confidenceBadge = (confidence: number | null) => {
    if (confidence === null)
      return <span className="text-xs text-gray-400">{t("noMatch")}</span>;
    let cls: string;
    let label: string;
    if (confidence >= 0.8) {
      cls = "bg-green-100 text-green-800";
      label = t("highConfidence");
    } else if (confidence >= 0.5) {
      cls = "bg-yellow-100 text-yellow-800";
      label = t("mediumConfidence");
    } else {
      cls = "bg-red-100 text-red-800";
      label = t("lowConfidence");
    }
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}
      >
        {label} ({Math.round(confidence * 100)}%)
      </span>
    );
  };

  if (!canReadFinance) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        Not authorized
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold text-gray-900">
            {t("bankImport")}
          </h1>
        </div>

        {/* Error Banner */}
        {banner && (
          <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            <span>{banner}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        )}

        {/* Upload Section */}
        {canWriteFinance && (
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              {t("uploadFile")}
            </h2>
            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.mt940,.camt"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                className="block text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-orange-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-orange-600 hover:file:bg-orange-100"
              />
              <button
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="inline-flex items-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading ? (
                  <span className="inline-flex items-center">
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                    {t("processing")}
                  </span>
                ) : (
                  t("upload")
                )}
              </button>
              <div className="ml-4 border-l border-gray-200 pl-4">
                <input
                  ref={camtInputRef}
                  type="file"
                  accept=".xml"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCamtUpload(file);
                  }}
                />
                <button
                  onClick={() => camtInputRef.current?.click()}
                  disabled={uploadingCamt}
                  className="inline-flex items-center rounded-lg border border-orange-600 bg-white px-4 py-2 text-sm font-medium text-orange-600 transition-colors hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {uploadingCamt ? (
                    <span className="inline-flex items-center">
                      <span className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-orange-600" />
                      {t("processing")}
                    </span>
                  ) : (
                    t("importCamt")
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-orange-600" />
          </div>
        )}

        {/* Search */}
        {!loading && !viewingImport && (
          <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
            <div className="relative">
              <svg
                className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder={t("searchBankImports")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-10 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>
        )}

        {/* Import History */}
        {!loading && !viewingImport && (
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              {t("importHistory")}
            </h2>
            {filteredImports.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                {t("noImports")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        File
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Items
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredImports.map((imp) => (
                      <tr key={imp.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {new Date(imp.importDate).toLocaleDateString("de-CH")}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {imp.fileName}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-500">
                          {imp.itemCount}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {statusBadge(imp.status)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setViewingImportId(imp.id)}
                            className="text-sm font-medium text-orange-600 hover:text-orange-800"
                          >
                            {t("viewItems")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Import Detail View */}
        {viewingImport && (
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {viewingImport.fileName}
              </h2>
              <button
                onClick={() => setViewingImportId(null)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ← Back
              </button>
            </div>

            {detailLoading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-orange-600" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Description
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        {t("debtorName")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        {t("endToEndId")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        {t("creditorReference")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        {t("matchSuggestion")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {viewingImport.items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {new Date(item.transactionDate).toLocaleDateString(
                            "de-CH"
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div>{item.description}</div>
                          {item.remittanceInfo &&
                            item.remittanceInfo !== item.description && (
                              <div
                                className="text-xs text-gray-400"
                                title={t("remittanceInfo")}
                              >
                                {item.remittanceInfo}
                              </div>
                            )}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-900">
                          {formatCHF(item.amount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          <div>{item.debtorName ?? "—"}</div>
                          {item.debtorIban && (
                            <div className="text-xs text-gray-400">
                              {item.debtorIban}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {item.endToEndId ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {item.creditorReference ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {confidenceBadge(item.matchConfidence)}
                          {item.suggestedInvoiceId &&
                            item.status === "Unmatched" &&
                            canWriteFinance && (
                              <div className="mt-1 flex gap-1">
                                <button
                                  onClick={() =>
                                    handleAcceptMatch(
                                      viewingImport.id,
                                      item.id,
                                      item.suggestedInvoiceId!
                                    )
                                  }
                                  className="rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 hover:bg-green-100"
                                >
                                  {t("acceptMatch")}
                                </button>
                                <button
                                  onClick={() =>
                                    handleRejectMatch(viewingImport.id, item.id)
                                  }
                                  className="rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-100"
                                >
                                  {t("rejectMatch")}
                                </button>
                              </div>
                            )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {statusBadge(item.status)}
                        </td>
                        <td className="space-x-2 px-4 py-3 text-right">
                          {item.status === "Unmatched" && canWriteFinance && (
                            <>
                              <button
                                onClick={() => openMatchModal(item)}
                                className="text-sm font-medium text-orange-600 hover:text-orange-800"
                              >
                                {t("match")}
                              </button>
                              <button
                                onClick={() =>
                                  handleIgnore(viewingImport.id, item.id)
                                }
                                className="text-sm font-medium text-gray-500 hover:text-gray-700"
                              >
                                {t("ignore")}
                              </button>
                            </>
                          )}
                          {item.status === "Matched" && (
                            <span className="text-xs text-gray-400">
                              {item.paymentId}
                            </span>
                          )}
                          {item.status === "Ignored" && canWriteFinance && (
                            <button
                              onClick={() =>
                                handleUnmatch(viewingImport.id, item.id)
                              }
                              className="text-sm font-medium text-gray-500 hover:text-gray-700"
                            >
                              {t("unmatch")}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Match Modal */}
        {showMatchModal && matchingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-lg">
              <h2 className="text-lg font-semibold text-gray-900">
                {t("match")}
              </h2>

              <div className="space-y-1 rounded-lg bg-gray-50 p-3 text-sm">
                <p>
                  <span className="font-medium">Description:</span>{" "}
                  {matchingItem.description}
                </p>
                <p>
                  <span className="font-medium">Amount:</span>{" "}
                  {formatCHF(matchingItem.amount)}
                </p>
                <p>
                  <span className="font-medium">{t("iban")}:</span>{" "}
                  {matchingItem.iban}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Payment ID
                </label>
                <input
                  type="text"
                  value={matchPaymentId}
                  onChange={(e) => setMatchPaymentId(e.target.value)}
                  placeholder="Enter existing payment ID or leave blank to create new"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={() => setShowMatchModal(false)}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMatch}
                  disabled={matchSubmitting}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {matchSubmitting ? (
                    <span className="inline-flex items-center">
                      <span className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                      Matching…
                    </span>
                  ) : (
                    t("match")
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export function BankImportContent() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <BankImportBody />
    </QueryClientProvider>
  );
}
