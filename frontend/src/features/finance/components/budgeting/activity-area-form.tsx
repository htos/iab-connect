"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import {
  activityAreaFormSchema,
  type ActivityAreaFormSchemaValues,
} from "../../schemas/activity-area.schema";

const XIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

// Predefined colors (page-local palette — preserved verbatim).
const PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
  "#78716c",
];

interface ActivityAreaFormProps {
  editing: boolean;
  defaultValues: ActivityAreaFormSchemaValues;
  pending: boolean;
  onSubmit: (values: ActivityAreaFormSchemaValues) => void;
  onClose: () => void;
}

/**
 * Activity-area create/edit dialog — RHF + Zod (E22 sub-recipe). Required-ness matches the
 * god-page enable-gate EXACTLY (name + code). A96: NO submitted byte is trimmed. The
 * isActive toggle + the color preset swatches set form values via `setValue` (the toggle is
 * edit-only). The color/text inputs keep the page-local markup + the `color` preview.
 */
export function ActivityAreaForm({
  editing,
  defaultValues,
  pending,
  onSubmit,
  onClose,
}: ActivityAreaFormProps) {
  const t = useTranslations("activityAreas");
  const tc = useTranslations("common");
  const { register, handleSubmit, setValue, control } =
    useForm<ActivityAreaFormSchemaValues>({
      resolver: zodResolver(activityAreaFormSchema),
      defaultValues,
    });

  const color = useWatch({ control, name: "color" });
  const isActive = useWatch({ control, name: "isActive" });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {editing ? t("editActivityArea") : t("addActivityArea")}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("name")} *
              </label>
              <input
                type="text"
                placeholder={t("namePlaceholder")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                {...register("name")}
              />
            </div>

            {/* Code */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("code")} *
              </label>
              <input
                type="text"
                placeholder={t("codePlaceholder")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm uppercase focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                {...register("code")}
              />
            </div>

            {/* Description */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("description")}
              </label>
              <input
                type="text"
                placeholder={t("descriptionPlaceholder")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                {...register("description")}
              />
            </div>

            {/* Color */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("color")}
              </label>
              <div className="space-y-2">
                {/* Preset color swatches */}
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() =>
                        setValue("color", c, { shouldValidate: true })
                      }
                      className={`h-6 w-6 rounded border-2 transition-transform hover:scale-110 ${
                        color === c
                          ? "border-gray-800 ring-2 ring-orange-400"
                          : "border-gray-200"
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
                {/* Custom color inputs */}
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color || "#ea580c"}
                    onChange={(e) =>
                      setValue("color", e.target.value, {
                        shouldValidate: true,
                      })
                    }
                    className="h-9 w-12 cursor-pointer rounded border border-gray-300"
                  />
                  <input
                    type="text"
                    placeholder={t("colorPlaceholder")}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                    {...register("color")}
                  />
                </div>
              </div>
            </div>

            {/* Sort Order + Active toggle row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("sortOrder")}
                </label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                  {...register("sortOrder", { valueAsNumber: true })}
                />
              </div>
              {editing && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("isActive")}
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setValue("isActive", !isActive, { shouldValidate: true })
                    }
                    className={`relative mt-0.5 inline-flex h-9 w-16 items-center rounded-full transition-colors focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:outline-none ${
                      isActive ? "bg-green-500" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-7 w-7 transform rounded-full bg-white shadow-sm transition-transform ${
                        isActive ? "translate-x-8" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              {tc("cancel")}
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
            >
              {pending ? tc("saving") : tc("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
