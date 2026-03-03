"use client";

import { formatCHF } from "@/lib/utils";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, useApiClient } from "@/lib/auth";

interface BankImport {
  id: string;
  importDate: string;
  fileName: string;
  status: string;
  itemCount: number;
}

interface BankImportItem {
  id: string;
  transactionDate: string;
  description: string;
  amount: number;
  iban: string;
  reference: string;
  status: "Unmatched" | "Matched" | "Ignored";
  paymentId: string | null;
  endToEndId: string | null;
  creditorReference: string | null;
  remittanceInfo: string | null;
  debtorName: string | null;
  debtorIban: string | null;
  suggestedInvoiceId: string | null;
  matchConfidence: number | null;
}

interface BankImportDetail extends BankImport {
  items: BankImportItem[];
}


export default function BankImportPage() {
  const t = useTranslations("finance");
  const { canReadFinance, canWriteFinance } = useAuth();
  const api = useApiClient();
  const router = useRouter();

  const tRef = useRef(t);
  tRef.current = t;
  const apiRef = useRef(api);
  apiRef.current = api;

  const [imports, setImports] = useState<BankImport[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const camtInputRef = useRef<HTMLInputElement>(null);
  const [uploadingCamt, setUploadingCamt] = useState(false);

  // Detail view
  const [viewingImport, setViewingImport] = useState<BankImportDetail | null>(
    null
  );
  const [detailLoading, setDetailLoading] = useState(false);

  // Match modal
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchingItem, setMatchingItem] = useState<BankImportItem | null>(null);
  const [matchPaymentId, setMatchPaymentId] = useState("");
  const [matchSubmitting, setMatchSubmitting] = useState(false);

  const fetchImports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRef.current.get("/api/v1/finance/bank-imports");
      if (res.error) throw new Error(res.error);
      const body = res.data as { items: BankImport[] };
      setImports(body.items ?? []);
    } catch {
      setError("Failed to load bank imports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canReadFinance) {
      fetchImports();
    }
  }, [canReadFinance, fetchImports]);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      await apiRef.current.upload("/api/v1/finance/bank-imports", formData);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await fetchImports();
    } catch {
      setError("Failed to upload file");
    } finally {
      setUploading(false);
    }
  }, [selectedFile, fetchImports]);

  const handleCamtUpload = useCallback(async (file: File) => {
    setUploadingCamt(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await apiRef.current.upload("/api/v1/finance/bank-imports/camt", formData);
      if (camtInputRef.current) {
        camtInputRef.current.value = "";
      }
      await fetchImports();
    } catch {
      setError("Failed to import camt file");
    } finally {
      setUploadingCamt(false);
    }
  }, [fetchImports]);

  const viewImportItems = useCallback(async (importId: string) => {
    setDetailLoading(true);
    setError(null);
    try {
      const res = await apiRef.current.get(
        `/api/v1/finance/bank-imports/${importId}`
      );
      if (res.error) throw new Error(res.error);
      setViewingImport(res.data as BankImportDetail);
    } catch {
      setError("Failed to load import details");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleIgnore = useCallback(
    async (importId: string, itemId: string) => {
      try {
        await apiRef.current.post(
          `/api/v1/finance/bank-imports/${importId}/items/${itemId}/ignore`,
          {}
        );
        if (viewingImport) {
          await viewImportItems(viewingImport.id);
        }
      } catch {
        setError("Failed to ignore item");
      }
    },
    [viewingImport, viewImportItems]
  );

  const handleAcceptMatch = useCallback(
    async (importId: string, itemId: string, invoiceId: string) => {
      try {
        await apiRef.current.put(
          `/api/v1/finance/bank-imports/${importId}/items/${itemId}/accept-match`,
          { invoiceId }
        );
        if (viewingImport) {
          await viewImportItems(viewingImport.id);
        }
      } catch {
        setError("Failed to accept match");
      }
    },
    [viewingImport, viewImportItems]
  );

  const handleRejectMatch = useCallback(
    async (importId: string, itemId: string) => {
      try {
        await apiRef.current.put(
          `/api/v1/finance/bank-imports/${importId}/items/${itemId}/reject-match`,
          {}
        );
        if (viewingImport) {
          await viewImportItems(viewingImport.id);
        }
      } catch {
        setError("Failed to reject match");
      }
    },
    [viewingImport, viewImportItems]
  );

  const openMatchModal = useCallback((item: BankImportItem) => {
    setMatchingItem(item);
    setMatchPaymentId("");
    setShowMatchModal(true);
  }, []);

  const handleMatch = useCallback(async () => {
    if (!matchingItem || !viewingImport) return;
    setMatchSubmitting(true);
    try {
      await apiRef.current.put(
        `/api/v1/finance/bank-imports/${viewingImport.id}/items/${matchingItem.id}/match`,
        { paymentId: matchPaymentId }
      );
      setShowMatchModal(false);
      await viewImportItems(viewingImport.id);
    } catch {
      setError("Failed to match item");
    } finally {
      setMatchSubmitting(false);
    }
  }, [matchingItem, viewingImport, matchPaymentId, viewImportItems]);

  const handleUnmatch = useCallback(
    async (importId: string, itemId: string) => {
      try {
        await apiRef.current.put(
          `/api/v1/finance/bank-imports/${importId}/items/${itemId}/ignore`,
          {}
        );
        if (viewingImport) {
          await viewImportItems(viewingImport.id);
        }
      } catch {
        setError("Failed to unmatch item");
      }
    },
    [viewingImport, viewImportItems]
  );

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
        label: () => tRef.current("pending"),
      },
      Processed: {
        cls: "bg-green-100 text-green-800",
        label: () => tRef.current("processed"),
      },
      Unmatched: {
        cls: "bg-yellow-100 text-yellow-800",
        label: () => tRef.current("unmatched"),
      },
      Matched: {
        cls: "bg-green-100 text-green-800",
        label: () => tRef.current("matched"),
      },
      Ignored: {
        cls: "bg-gray-100 text-gray-600",
        label: () => tRef.current("ignored"),
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
    if (confidence === null) return <span className="text-xs text-gray-400">{tRef.current("noMatch")}</span>;
    let cls: string;
    let label: string;
    if (confidence >= 0.8) {
      cls = "bg-green-100 text-green-800";
      label = tRef.current("highConfidence");
    } else if (confidence >= 0.5) {
      cls = "bg-yellow-100 text-yellow-800";
      label = tRef.current("mediumConfidence");
    } else {
      cls = "bg-red-100 text-red-800";
      label = tRef.current("lowConfidence");
    }
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
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
        <Link href="/finance/settings" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
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
          <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder={t("searchBankImports")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
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
                            onClick={() => viewImportItems(imp.id)}
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
                onClick={() => setViewingImport(null)}
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
                          {item.remittanceInfo && item.remittanceInfo !== item.description && (
                            <div className="text-xs text-gray-400" title={t("remittanceInfo")}>
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
                            <div className="text-xs text-gray-400">{item.debtorIban}</div>
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
                          {item.suggestedInvoiceId && item.status === "Unmatched" && canWriteFinance && (
                            <div className="mt-1 flex gap-1">
                              <button
                                onClick={() =>
                                  handleAcceptMatch(viewingImport.id, item.id, item.suggestedInvoiceId!)
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
