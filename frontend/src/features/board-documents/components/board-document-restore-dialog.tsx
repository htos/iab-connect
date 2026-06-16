"use client";

import { useTranslations } from "next-intl";

interface BoardDocumentRestoreDialogProps {
  // The version number pending restore; null closes the dialog (controlled).
  versionNumber: number | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Restore-version confirm for the document detail (E29-S3). Markup/classes
 * preserved VERBATIM from the god-page (`[id]/page.tsx:493-536`) — including the
 * blue (NON-destructive) icon + confirm button. A86 does NOT recolour Restore:
 * the god-page already had an in-component modal here (not a bare `confirm()`),
 * so it keeps its existing styling; only the delete affordance (which WAS a bare
 * in-component confirm) becomes the destructive Radix dialog.
 */
export function BoardDocumentRestoreDialog({
  versionNumber,
  onConfirm,
  onCancel,
}: BoardDocumentRestoreDialogProps) {
  const t = useTranslations();
  if (versionNumber === null) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
            <svg
              className="h-6 w-6 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            {t("documents.restore")}
          </h3>
        </div>
        <p className="mb-6 text-sm text-gray-600">
          {t("documents.confirmRestore")}
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {t("documents.restore")}
          </button>
        </div>
      </div>
    </div>
  );
}
