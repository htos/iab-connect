"use client";

/**
 * Create-backup modal (E27-S4). Structure + the notes textarea (`createModal.notes`
 * label wired via htmlFor/id so the S1 net's `getByLabelText` resolves it) + the
 * confirm/cancel buttons preserved verbatim from the god-page. The parent owns
 * submit; this dialog is controlled (notes lifted to the parent so the create
 * mutation reads it).
 */

import { useTranslations } from "next-intl";

interface CreateBackupDialogProps {
  notes: string;
  isCreating: boolean;
  onNotesChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CreateBackupDialog({
  notes,
  isCreating,
  onNotesChange,
  onConfirm,
  onCancel,
}: CreateBackupDialogProps) {
  const t = useTranslations("admin.backups");
  const tCommon = useTranslations("common");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          {t("createModal.title")}
        </h2>
        <p className="mb-4 text-sm text-gray-600">
          {t("createModal.description")}
        </p>
        <div className="mb-4">
          <label
            htmlFor="backup-notes"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            {t("createModal.notes")}
          </label>
          <textarea
            id="backup-notes"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder={t("createModal.notesPlaceholder")}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
            rows={3}
            maxLength={1000}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-xl bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
            disabled={isCreating}
          >
            {tCommon("cancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={isCreating}
            className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {isCreating ? (
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
            )}
            {t("createModal.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
