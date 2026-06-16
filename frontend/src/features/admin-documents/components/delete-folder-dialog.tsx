"use client";

import { useTranslations } from "next-intl";

interface DeleteFolderDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Delete-folder confirmation modal (E27-S6). A86: a STYLED modal with a RED
 * destructive confirm — NOT `window.confirm`. The markup is preserved verbatim
 * from the god-page (the E27-S1 net asserts the `documents.deleteFolderTitle` +
 * `documents.confirmDeleteFolder` copy AND that the confirm button carries the
 * real `bg-red-600` destructive class). The close-before-await behaviour lives in
 * the content: it closes this modal BEFORE awaiting the delete, so on failure the
 * error banner shows while the modal is already gone (E27-S1 net).
 */
export function DeleteFolderDialog({
  onConfirm,
  onCancel,
}: DeleteFolderDialogProps) {
  const t = useTranslations();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            {t("documents.deleteFolderTitle")}
          </h3>
        </div>
        <p className="mb-6 text-sm text-gray-600">
          {t("documents.confirmDeleteFolder")}
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
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            {t("common.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
