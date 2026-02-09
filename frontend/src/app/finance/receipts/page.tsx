"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth, useApiClient } from "@/lib/auth";

interface Receipt {
  id: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  notes: string;
  createdAt: string;
}

const formatFileSize = (size: number) =>
  size > 1048576
    ? `${(size / 1048576).toFixed(1)} MB`
    : `${(size / 1024).toFixed(1)} KB`;

export default function ReceiptsPage() {
  const t = useTranslations("finance");
  const router = useRouter();
  const { canReadFinance, canWriteFinance } = useAuth();
  const api = useApiClient();

  const apiRef = useRef(api);
  apiRef.current = api;
  const tRef = useRef(t);
  tRef.current = t;

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");

  const fetchReceipts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiRef.current.get("/api/v1/finance/receipts");
      if (res.error) throw new Error(res.error);
      setReceipts(res.data as Receipt[]);
    } catch {
      setError(tRef.current("loadError"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canReadFinance) {
      router.replace("/");
      return;
    }
    fetchReceipts();
  }, [canReadFinance, router, fetchReceipts]);

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

  const handleUpload = useCallback(async () => {
    if (!file) return;
    try {
      setSaving(true);
      setError(null);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("notes", notes);
      await apiRef.current.upload("/api/v1/finance/receipts", formData);
      closeModal();
      await fetchReceipts();
    } catch {
      setError(tRef.current("saveError"));
    } finally {
      setSaving(false);
    }
  }, [file, notes, fetchReceipts]);

  const handleDownload = useCallback(async (receipt: Receipt) => {
    try {
      const res = await apiRef.current.get(
        `/api/v1/finance/receipts/${receipt.id}/download`
      );
      if (res.error) throw new Error(res.error);
      const url = window.URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = receipt.fileName;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError(tRef.current("loadError"));
    }
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteConfirmId) return;
    try {
      setDeleting(true);
      setError(null);
      await apiRef.current.delete(
        `/api/v1/finance/receipts/${deleteConfirmId}`
      );
      setDeleteConfirmId(null);
      await fetchReceipts();
    } catch {
      setError(tRef.current("deleteError"));
    } finally {
      setDeleting(false);
    }
  }, [deleteConfirmId, fetchReceipts]);

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

        {/* Loading Spinner */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
          </div>
        )}

        {/* Empty State */}
        {!loading && receipts.length === 0 && (
          <div className="rounded-xl bg-white p-6 text-center text-gray-500 shadow-sm">
            {t("noReceipts")}
          </div>
        )}

        {/* Receipts Grid */}
        {!loading && receipts.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {receipts.map((receipt) => (
              <div
                key={receipt.id}
                className="flex flex-col gap-3 rounded-xl bg-white p-6 shadow-sm"
              >
                {/* Icon / Thumbnail */}
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

                {/* Notes */}
                {receipt.notes && (
                  <p className="line-clamp-2 text-sm text-gray-600">
                    {receipt.notes}
                  </p>
                )}

                {/* Upload Date */}
                <p className="text-xs text-gray-400">
                  {t("uploadDate")}:{" "}
                  {new Date(receipt.createdAt).toLocaleDateString("de-CH")}
                </p>

                {/* Actions */}
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
                {/* File Input */}
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

                {/* Notes */}
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
