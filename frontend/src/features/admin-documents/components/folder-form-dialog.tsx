"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import {
  folderFormSchema,
  type FolderFormValues,
} from "../schemas/folder.schema";

interface FolderFormDialogProps {
  // Modal heading + the i18n key for it. Create uses "documents.createFolder"
  // (which also labels the header trigger — the E27-S1 net relies on the <h2>
  // carrying this exact key inside a `div.bg-white` card); edit uses
  // "documents.editFolder".
  titleKey: string;
  defaultValues: FolderFormValues;
  // Rendered above the fields in create mode when nested under a parent folder
  // (god-page: "documents.parentFolder: <name>"). Omitted for edit / root.
  parentHint?: string | null;
  onSubmit: (values: FolderFormValues) => void;
  onCancel: () => void;
}

const inputClass = "w-full rounded-lg border border-gray-300 px-3 py-2";

/**
 * Shared create/edit folder modal (E27-S6). The E22 RHF+Zod sub-recipe applied
 * to the god-page's create/edit folder dialogs. Behaviour preserved (A79 / E27-S1
 * net): the SAME modal markup (`fixed inset-0 ... bg-black/50` overlay, a
 * `div.bg-white` card, an `<h2>` carrying the title key, a single text input for
 * the name, a description `<textarea>`, Cancel + Save), the Save button DISABLED
 * until a non-whitespace name is present (god-page `disabled={!name.trim()}`),
 * and `noValidate` per-field errors (A96 — no `.trim()` on the submitted name).
 */
export function FolderFormDialog({
  titleKey,
  defaultValues,
  parentHint,
  onSubmit,
  onCancel,
}: FolderFormDialogProps) {
  const t = useTranslations();
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FolderFormValues>({
    resolver: zodResolver(folderFormSchema),
    defaultValues,
    mode: "onChange",
  });

  // Mirror the god-page's `disabled={!name.trim()}` gate without trimming the
  // SUBMITTED value (A96): the disabled flag reads the live trimmed name.
  // `useWatch` (the hook form) is React-Compiler-safe, unlike the `watch()` fn.
  const nameValue = useWatch({ control, name: "name" });
  const saveDisabled = !nameValue || !nameValue.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-bold">{t(titleKey)}</h2>
        {parentHint && (
          <p className="mb-3 text-sm text-gray-500">
            {t("documents.parentFolder")}: {parentHint}
          </p>
        )}
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("common.name")}
              </label>
              <input
                type="text"
                className={inputClass}
                autoFocus
                {...register("name")}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">
                  {t(errors.name.message ?? "form.required")}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("documents.description")}
              </label>
              <textarea
                rows={2}
                className={inputClass}
                {...register("description")}
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
              disabled={saveDisabled}
              className="rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {t("common.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
