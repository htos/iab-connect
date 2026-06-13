"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import {
  categoryFormSchema,
  type CategoryFormSchemaValues,
} from "../../schemas/category.schema";

interface CategoryFormProps {
  editing: boolean;
  defaultValues: CategoryFormSchemaValues;
  pending: boolean;
  onSubmit: (values: CategoryFormSchemaValues) => void;
  onClose: () => void;
}

/**
 * Category create/edit modal form — RHF + Zod (E22 sub-recipe). Required-ness matches the
 * god-page enable-gate EXACTLY (name only). `type` is the closed Income/Expense set. A96:
 * NO submitted byte trimmed. The color picker + hex input both bind to `color` via
 * `setValue`/`register`. The checkbox binds `isActive`.
 */
export function CategoryForm({
  editing,
  defaultValues,
  pending,
  onSubmit,
  onClose,
}: CategoryFormProps) {
  const t = useTranslations("finance");
  const { register, handleSubmit, setValue, control } =
    useForm<CategoryFormSchemaValues>({
      resolver: zodResolver(categoryFormSchema),
      defaultValues,
    });

  const color = useWatch({ control, name: "color" });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-lg">
        <h2 className="text-lg font-bold text-gray-900">
          {editing ? t("editCategory") : t("newCategory")}
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-3">
            {/* Name */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("categoryName")} *
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                {...register("name")}
              />
            </div>

            {/* Type */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("categoryType")} *
              </label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                {...register("type")}
              >
                <option value="Income">{t("income")}</option>
                <option value="Expense">{t("expense")}</option>
              </select>
            </div>

            {/* Color */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("color")}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={color}
                  onChange={(e) =>
                    setValue("color", e.target.value, { shouldValidate: true })
                  }
                  className="h-10 w-10 cursor-pointer rounded border border-gray-300"
                />
                <input
                  type="text"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  {...register("color")}
                />
              </div>
            </div>

            {/* IsActive */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                {...register("isActive")}
              />
              <label
                htmlFor="isActive"
                className="text-sm font-medium text-gray-700"
              >
                {t("active")}
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
            >
              {pending ? "..." : t("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
