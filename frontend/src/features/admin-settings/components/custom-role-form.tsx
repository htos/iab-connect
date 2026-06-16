"use client";

/**
 * Custom-role create/edit modal form (E27-S3, DEC-2 = RHF+Zod). Behaviour preserved
 * from the god-page role modal (pinned by the E27-S1 net): name / description /
 * linkedRole `<select>` / color / sortOrder, the `isActive` checkbox rendered ONLY in
 * edit mode, and submit disabled while the name is blank.
 *
 * A98 — the create/edit mode-divergent surfaces are threaded through props (the
 * `isActive` field + the title + the submit label differ by mode); both modes are
 * pinned by tests. A95 — the `linkedRole <select>` offers the three canonical options
 * PLUS an extra `<option>` for an out-of-set STORED value so an edit round-trips it
 * (the widened schema accepts any string). A96 — no `.trim()`/transform; `<form
 * noValidate>` surfaces the blank-name field error.
 */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import {
  CANONICAL_LINKED_ROLES,
  customRoleSchema,
  type CustomRoleValues,
} from "../schemas/custom-role.schema";

interface CustomRoleFormProps {
  mode: "create" | "edit";
  defaultValues: CustomRoleValues;
  onSubmit: (values: CustomRoleValues) => void;
  onCancel: () => void;
  pending: boolean;
}

const inputClass =
  "w-full rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500";

export function CustomRoleForm({
  mode,
  defaultValues,
  onSubmit,
  onCancel,
  pending,
}: CustomRoleFormProps) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CustomRoleValues>({
    resolver: zodResolver(customRoleSchema),
    defaultValues,
  });

  // RHF watch() drives the color swatch + the blank-name submit guard. React Compiler
  // skipping memoization here is harmless (re-renders with its parent).
  // eslint-disable-next-line react-hooks/incompatible-library
  const name = watch("name");
  const color = watch("color");
  const linkedRole = watch("linkedRole");

  // A95: render the canonical options + (when editing a stored role whose linkedRole
  // is out of the canonical set) an extra option carrying that value so it round-trips.
  const outOfSetLinkedRole =
    linkedRole &&
    !(CANONICAL_LINKED_ROLES as readonly string[]).includes(linkedRole)
      ? linkedRole
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      {/* Modal */}
      <div className="relative mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <h3 className="mb-6 text-lg font-semibold text-gray-900">
          {mode === "edit" ? t("editRole") : t("createRole")}
        </h3>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("roleName")}
              </label>
              <input type="text" className={inputClass} {...register("name")} />
              {errors.name && (
                <p className="mt-1 text-xs text-red-600">
                  {t(errors.name.message ?? "form.required")}
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("roleDescription")}
              </label>
              <textarea
                rows={3}
                className="w-full resize-none rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                {...register("description")}
              />
            </div>

            {/* Linked Role */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("linkedRole")}
              </label>
              <select className={inputClass} {...register("linkedRole")}>
                {CANONICAL_LINKED_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
                {outOfSetLinkedRole && (
                  <option value={outOfSetLinkedRole}>
                    {outOfSetLinkedRole}
                  </option>
                )}
              </select>
            </div>

            {/* Color & Sort Order row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("color")}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setValue("color", e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded border border-gray-300"
                  />
                  <input
                    type="text"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                    {...register("color")}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("sortOrder")}
                </label>
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  {...register("sortOrder", { valueAsNumber: true })}
                />
              </div>
            </div>

            {/* Is Active (A98 — edit mode only) */}
            {mode === "edit" && (
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="roleIsActive"
                  className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  {...register("isActive")}
                />
                <label
                  htmlFor="roleIsActive"
                  className="text-sm font-medium text-gray-700"
                >
                  {t("isActive")}
                </label>
              </div>
            )}
          </div>

          {/* Modal actions */}
          <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-gray-300 px-4 py-2 font-medium transition-colors hover:bg-gray-50"
            >
              {tCommon("cancel")}
            </button>
            <button
              type="submit"
              disabled={pending || !name.trim()}
              className="rounded-lg bg-orange-600 px-6 py-2 font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
            >
              {pending
                ? t("saving")
                : mode === "edit"
                  ? t("editRole")
                  : t("createRole")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
