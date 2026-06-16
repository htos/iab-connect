"use client";

/**
 * Upload-backup modal (E27-S4). Structure + the file input (`uploadModal.file`)
 * and notes textarea (`uploadModal.notes`) — both wired via htmlFor/id so the S1
 * net's `getByLabelText` resolves them — preserved verbatim from the god-page. The
 * confirm button stays disabled until a file is chosen (S1-pinned). The parent
 * owns submit + the file/notes state + the file-input ref (so it can clear it).
 */

import type { RefObject } from "react";
import { useTranslations } from "next-intl";

interface UploadBackupDialogProps {
  fileInputRef: RefObject<HTMLInputElement | null>;
  notes: string;
  hasFile: boolean;
  isUploading: boolean;
  onFileChange: (file: File | null) => void;
  onNotesChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function UploadBackupDialog({
  fileInputRef,
  notes,
  hasFile,
  isUploading,
  onFileChange,
  onNotesChange,
  onConfirm,
  onCancel,
}: UploadBackupDialogProps) {
  const t = useTranslations("admin.backups");
  const tCommon = useTranslations("common");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          {t("uploadModal.title")}
        </h2>
        <p className="mb-4 text-sm text-gray-600">
          {t("uploadModal.description")}
        </p>
        <div className="mb-4">
          <label
            htmlFor="backup-file"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            {t("uploadModal.file")}
          </label>
          <input
            ref={fileInputRef}
            id="backup-file"
            type="file"
            accept=".sql,.dump,.backup"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div className="mb-4">
          <label
            htmlFor="upload-notes"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            {t("uploadModal.notes")}
          </label>
          <textarea
            id="upload-notes"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder={t("uploadModal.notesPlaceholder")}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
            rows={2}
            maxLength={1000}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-xl bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
            disabled={isUploading}
          >
            {tCommon("cancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={isUploading || !hasFile}
            className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {isUploading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
            ) : (
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
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
            )}
            {t("uploadModal.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
