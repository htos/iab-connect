"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { formatFileSize } from "@/lib/services/documents";
import {
  boardDocumentVersionSchema,
  type BoardDocumentVersionValues,
} from "../schemas/board-document.schema";

interface BoardDocumentVersionDialogProps {
  open: boolean;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (values: { file: File; comment: string }) => void;
}

/**
 * New-version upload modal for the document detail (E29-S3, DEC-2 = A — RHF+Zod).
 * Markup/classes preserved from the god-page (`[id]/page.tsx:347-432`). The
 * optional `comment` is the RHF+Zod form value; the FILE is local state and
 * gates the submit (`disabled={!versionFile || uploading}`, god-page parity). On
 * submit the composed input goes to the parent's version-upload mutation; the
 * parent closes the dialog + shows the toast.
 *
 * The file + comment live in a `Body` mounted ONLY while `open` — so each fresh
 * open starts from defaults, and (the E29 review P2 fix) an upload FAILURE keeps
 * the dialog open with the chosen file + typed comment intact: the parent closes
 * the dialog only in the mutation `onSuccess`, so on error the same `Body` stays
 * mounted and nothing is cleared (god-page parity: `setVersionFile(null)` ran
 * only after the upload succeeded).
 */
export function BoardDocumentVersionDialog({
  open,
  pending,
  onCancel,
  onSubmit,
}: BoardDocumentVersionDialogProps) {
  if (!open) return null;
  return (
    <BoardDocumentVersionDialogBody
      pending={pending}
      onCancel={onCancel}
      onSubmit={onSubmit}
    />
  );
}

function BoardDocumentVersionDialogBody({
  pending,
  onCancel,
  onSubmit,
}: Omit<BoardDocumentVersionDialogProps, "open">) {
  const t = useTranslations();
  const [file, setFile] = useState<File | null>(null);

  const { register, handleSubmit } = useForm<BoardDocumentVersionValues>({
    resolver: zodResolver(boardDocumentVersionSchema),
    defaultValues: { comment: "" },
  });

  const submit = (values: BoardDocumentVersionValues) => {
    if (!file) return;
    onSubmit({ file, comment: values.comment });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-bold">
          {t("documents.uploadNewVersion")}
        </h2>
        <form onSubmit={handleSubmit(submit)} noValidate>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("documents.file")}
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-gray-300 p-4 transition-colors hover:border-orange-400 hover:bg-orange-50">
                <svg
                  className="h-8 w-8 text-gray-400"
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
                <div className="flex-1">
                  {file ? (
                    <>
                      <p className="text-sm font-medium text-gray-900">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.size)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-gray-700">
                        {t("documents.chooseFile")}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t("documents.dragOrClick")}
                      </p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("documents.versionComment")}
              </label>
              <textarea
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                {...register("comment")}
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={!file || pending}
              className="rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {pending ? t("documents.uploading") : t("documents.upload")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
