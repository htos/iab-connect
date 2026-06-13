"use client";

/**
 * Receipts content (E26-S3 migration of `app/finance/receipts/page.tsx`).
 * Composition root (only `"use client"`) — self-embeds its own `QueryClientProvider`.
 *
 * Lean read guard (A56): reads `canReadFinance` ONLY; useEffect → `router.replace("/")`;
 * render-time `if (!canReadFinance) return null`. Upload = `api.upload(file+notes)`; the
 * god-page upload handler does NOT inspect res.error (silent on upload failure) — the
 * mutation closes the modal from onSuccess (A92). Download = imperative GET blob → object
 * URL → anchor `download=<server fileName>` → click (anchor NOT DOM-appended). Delete =
 * modal confirm → DELETE (red button).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useApiClient, useAuth } from "@/lib/auth";
import { receivablesUrls } from "../../api/receivables-api";
import {
  useDeleteReceipt,
  useReceipts,
  useUploadReceipt,
} from "../../hooks/use-receipts";
import type { Receipt } from "../../types/receivables.types";

const formatFileSize = (size: number) =>
  size > 1048576
    ? `${(size / 1048576).toFixed(1)} MB`
    : `${(size / 1024).toFixed(1)} KB`;

function ReceiptsBody() {
  const t = useTranslations("finance");
  const router = useRouter();
  const { canReadFinance, canWriteFinance } = useAuth();
  const api = useApiClient();

  const receiptsQuery = useReceipts(canReadFinance);
  const receipts = receiptsQuery.data ?? [];
  const loading = canReadFinance && receiptsQuery.isLoading;

  const uploadMutation = useUploadReceipt();
  const deleteMutation = useDeleteReceipt();

  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const banner = error ?? (receiptsQuery.isError ? t("loadError") : null);

  useEffect(() => {
    if (!canReadFinance) {
      router.replace("/");
    }
  }, [canReadFinance, router]);

  const filteredReceipts = receipts.filter((r) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.fileName.toLowerCase().includes(term) ||
      r.notes?.toLowerCase().includes(term) ||
      new Date(r.createdAt).toLocaleDateString("de-CH").includes(term)
    );
  });

  const openUpload = () => {
    setFile(null);
    setNotes("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setFile(null);
    setNotes("");
  };

  const handleUpload = () => {
    if (!file) return;
    setError(null);
    uploadMutation.mutate(
      { file, notes },
      {
        onSuccess: () => closeModal(),
        onError: () => setError(t("saveError")),
      }
    );
  };

  const handleDownload = async (receipt: Receipt) => {
    try {
      const res = await api.get(receivablesUrls.receiptDownload(receipt.id));
      if (res.error) throw new Error(res.error);
      const url = window.URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = receipt.fileName;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError(t("loadError"));
    }
  };

  const handleDelete = () => {
    if (!deleteConfirmId) return;
    setError(null);
    deleteMutation.mutate(deleteConfirmId, {
      onSuccess: () => setDeleteConfirmId(null),
      onError: () => setError(t("deleteError")),
    });
  };

  const fileIcon = (contentType: string) => {
    if (contentType.startsWith("image/")) {
      return (
        <svg
          className="h-10 w-10 text-orange-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
          />
        </svg>
      );
    }
    return (
      <svg
        className="h-10 w-10 text-red-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
        />
      </svg>
    );
  };

  if (!canReadFinance) return null;

  const saving = uploadMutation.isPending;
  const deleting = deleteMutation.isPending;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{t("receipts")}</h1>
          {canWriteFinance && (
            <button
              onClick={openUpload}
              className="rounded-lg bg-orange-600 px-4 py-2 font-medium text-white transition-colors hover:bg-orange-700"
            >
              {t("uploadReceipt")}
            </button>
          )}
        </div>

        {/* Search */}
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
              placeholder={t("searchReceipts")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-10 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
            />
          </div>
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

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
          </div>
        )}

        {/* Empty */}
        {!loading && filteredReceipts.length === 0 && (
          <div className="rounded-xl bg-white p-6 text-center text-gray-500 shadow-sm">
            {t("noReceipts")}
          </div>
        )}

        {/* Grid */}
        {!loading && filteredReceipts.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredReceipts.map((receipt) => (
              <div
                key={receipt.id}
                className="flex flex-col gap-3 rounded-xl bg-white p-6 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  {fileIcon(receipt.contentType)}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {receipt.fileName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(receipt.fileSize)}
                    </p>
                  </div>
                </div>

                {receipt.notes && (
                  <p className="line-clamp-2 text-sm text-gray-600">
                    {receipt.notes}
                  </p>
                )}

                <p className="text-xs text-gray-400">
                  {t("uploadDate")}:{" "}
                  {new Date(receipt.createdAt).toLocaleDateString("de-CH")}
                </p>

                <div className="mt-auto flex items-center gap-2 border-t border-gray-100 pt-2">
                  <button
                    onClick={() => handleDownload(receipt)}
                    className="text-sm font-medium text-orange-600 hover:text-orange-700"
                  >
                    {t("download")}
                  </button>
                  {canWriteFinance && (
                    <button
                      onClick={() => setDeleteConfirmId(receipt.id)}
                      className="ml-auto text-sm font-medium text-red-600 hover:text-red-700"
                    >
                      {t("delete")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-lg">
              <h2 className="text-lg font-bold text-gray-900">
                {t("uploadReceipt")}
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("selectFile")} *
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.gif"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-orange-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-orange-700 hover:file:bg-orange-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("notes")}
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={closeModal}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={handleUpload}
                  disabled={saving || !file}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
                >
                  {saving ? "..." : t("save")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-lg">
              <h2 className="text-lg font-bold text-gray-900">{t("delete")}</h2>
              <p className="text-sm text-gray-600">{t("confirmDelete")}</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "..." : t("delete")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export function ReceiptsPageContent() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <ReceiptsBody />
    </QueryClientProvider>
  );
}
