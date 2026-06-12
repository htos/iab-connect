"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { formatFileSize } from "@/lib/services/documents";
import { DocumentCategory } from "../types/board-document.types";
import {
  boardDocumentUploadSchema,
  type BoardDocumentUploadValues,
} from "../schemas/board-document.schema";

interface BoardDocumentUploadDialogProps {
  open: boolean;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (values: {
    file: File;
    name: string;
    category: string;
    description: string;
    tags: string;
  }) => void;
}

/**
 * New-document upload modal (E29-S3, DEC-2 = A — RHF+Zod). Markup/classes
 * preserved verbatim from the god-page (`page.tsx:271-397`). The metadata
 * (name/description/category/tags) is a RHF+Zod form; the FILE is held in local
 * state (files don't round-trip through RHF values) and gates the submit button
 * exactly as the god-page (`disabled={!uploadFile || uploading}`). Choosing a
 * file auto-fills an empty name with the file's base name (god-page parity).
 * On submit the composed input is handed to the parent's upload mutation; the
 * parent closes the dialog + shows the success/error toast.
 *
 * The file + form live in a `Body` that is mounted ONLY while `open` — so each
 * fresh open starts from defaults, and (the E29 review P1 fix) an upload FAILURE
 * keeps the dialog open with the chosen file + typed fields intact: the parent
 * closes the dialog only in the mutation `onSuccess`, so on error the same
 * `Body` stays mounted and nothing is cleared (god-page parity:
 * `setUploadFile(null)` ran only after the upload succeeded).
 */
export function BoardDocumentUploadDialog({
  open,
  pending,
  onCancel,
  onSubmit,
}: BoardDocumentUploadDialogProps) {
  if (!open) return null;
  return (
    <BoardDocumentUploadDialogBody
      pending={pending}
      onCancel={onCancel}
      onSubmit={onSubmit}
    />
  );
}

function BoardDocumentUploadDialogBody({
  pending,
  onCancel,
  onSubmit,
}: Omit<BoardDocumentUploadDialogProps, "open">) {
  const t = useTranslations();
  const [file, setFile] = useState<File | null>(null);

  const { register, handleSubmit, setValue, getValues } =
    useForm<BoardDocumentUploadValues>({
      resolver: zodResolver(boardDocumentUploadSchema),
      defaultValues: {
        name: "",
        description: "",
        category: "General",
        tags: "",
      },
    });

  const submit = (values: BoardDocumentUploadValues) => {
    if (!file) return;
    onSubmit({
      file,
      name: values.name,
      category: values.category,
      description: values.description,
      tags: values.tags,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-bold">
          {t("documents.uploadDocument")}
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
                  onChange={(e) => {
                    const chosen = e.target.files?.[0] || null;
                    setFile(chosen);
                    if (!getValues("name") && chosen)
                      setValue("name", chosen.name.replace(/\.[^.]+$/, ""));
                  }}
                />
              </label>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("documents.documentName")}
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                {...register("name")}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("documents.description")}
              </label>
              <textarea
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                {...register("description")}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("documents.category")}
              </label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                {...register("category")}
              >
                {Object.values(DocumentCategory).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("documents.tags")}
              </label>
              <input
                type="text"
                placeholder={t("documents.tagsPlaceholder")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                {...register("tags")}
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
              className="rounded-lg bg-orange-600 px-4 py-2 text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
            >
              {pending ? t("documents.uploading") : t("documents.upload")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
