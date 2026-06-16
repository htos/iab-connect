"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import {
  segmentFormSchema,
  type SegmentFormValues,
} from "../schemas/segment.schema";
import {
  SegmentType,
  SEGMENT_COLORS,
  getSegmentColorClasses,
  type SegmentCriteria,
  type PreviewResult,
} from "../types/member-segment.types";

interface SegmentFormProps {
  mode: "create" | "edit";
  defaultValues: SegmentFormValues;
  // Dynamic-criteria initial state (edit prefills from the parsed criteriaJson;
  // create starts empty). The form owns the criteria builder state.
  defaultCriteria: SegmentCriteria;
  // criteriaJson is computed by the form (serialised when type === Dynamic,
  // undefined otherwise) so the content's create/update payload is shaped
  // exactly like the god-pages'.
  onSubmit: (
    values: SegmentFormValues,
    criteriaJson: string | undefined
  ) => void;
  onPreview: (criteriaJson: string) => void;
  preview: PreviewResult | null;
  previewing: boolean;
  submitIdleLabel: string;
  submitPendingLabel: string;
  pending: boolean;
  errorMessage: string | null;
  cancelHref: string;
}

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500";

const STATUS_OPTIONS = ["Active", "Inactive", "Pending"];
const TYPE_OPTIONS = ["Regular", "Student", "Honorary", "Family"];

/**
 * Shared new/edit segment form — the E22 RHF+Zod sub-recipe applied to Member
 * Segments (E23-S4). The two god-pages were byte-for-byte duplicated; this form
 * is the de-dup target (criteria builder + toggle handlers live here once). The
 * only mode deltas: create renders the editable type select; edit renders the
 * read-only type text (`segments.typeNotEditable`) + the `isActive` checkbox.
 * Behaviour-preserving: only `name` is validated (HTML5 `required` → Zod). The
 * Dynamic-criteria section + Preview render only when the effective type is
 * Dynamic, matching the god-pages.
 */
export function SegmentForm({
  mode,
  defaultValues,
  defaultCriteria,
  onSubmit,
  onPreview,
  preview,
  previewing,
  submitIdleLabel,
  submitPendingLabel,
  pending,
  errorMessage,
  cancelHref,
}: SegmentFormProps) {
  const t = useTranslations();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SegmentFormValues>({
    resolver: zodResolver(segmentFormSchema),
    defaultValues,
  });

  const [criteria, setCriteria] = useState<SegmentCriteria>(defaultCriteria);

  // create: the live select drives the criteria section; edit: type is fixed.
  // RHF's watch() is the intended reactive-read API; React Compiler skipping
  // memoization of this form is harmless (it re-renders with its parent anyway).
  // eslint-disable-next-line react-hooks/incompatible-library
  const segmentType = watch("segmentType");
  const selectedColor = watch("color");
  const isDynamic = segmentType === SegmentType.Dynamic;

  const handleCriteriaStatusToggle = (status: string) => {
    setCriteria((prev) => ({
      ...prev,
      status: prev.status?.includes(status)
        ? prev.status.filter((s) => s !== status)
        : [...(prev.status ?? []), status],
    }));
  };

  const handleCriteriaTypeToggle = (type: string) => {
    setCriteria((prev) => ({
      ...prev,
      type: prev.type?.includes(type)
        ? prev.type.filter((ty) => ty !== type)
        : [...(prev.type ?? []), type],
    }));
  };

  const submit = (values: SegmentFormValues) => {
    const criteriaJson = isDynamic ? JSON.stringify(criteria) : undefined;
    onSubmit(values, criteriaJson);
  };

  return (
    <>
      {errorMessage && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">{errorMessage}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(submit)} noValidate className="space-y-6">
        {/* Basic Info */}
        <div className="space-y-4 rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("segments.section.basicInfo")}
          </h2>

          <div>
            <label
              htmlFor="name"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              {t("segments.field.name")} *
            </label>
            <input
              type="text"
              id="name"
              className={inputClass}
              {...register("name")}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">
                {t(errors.name.message ?? "form.required")}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="description"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              {t("segments.field.description")}
            </label>
            <textarea
              id="description"
              rows={3}
              className={inputClass}
              {...register("description")}
            />
          </div>

          {mode === "create" ? (
            <div>
              <label
                htmlFor="segmentType"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                {t("segments.field.type")} *
              </label>
              <select
                id="segmentType"
                className={inputClass}
                {...register("segmentType")}
              >
                <option value={SegmentType.Static}>
                  {t("segments.type.static")}
                </option>
                <option value={SegmentType.Dynamic}>
                  {t("segments.type.dynamic")}
                </option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {isDynamic
                  ? t("segments.typeHint.dynamic")
                  : t("segments.typeHint.static")}
              </p>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("segments.field.type")}
              </label>
              <p className="text-sm text-gray-900">
                {t(`segments.type.${segmentType.toLowerCase()}`)}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {t("segments.typeNotEditable")}
              </p>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {t("segments.field.color")}
            </label>
            <div className="flex flex-wrap gap-2">
              {SEGMENT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setValue("color", color)}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${getSegmentColorClasses(
                    color
                  )} ${
                    selectedColor === color
                      ? "ring-2 ring-orange-500 ring-offset-2"
                      : ""
                  }`}
                >
                  {selectedColor === color && "✓"}
                </button>
              ))}
            </div>
          </div>

          {mode === "edit" && (
            <div className="flex items-center gap-3">
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
                {t("segments.field.isActive")}
              </label>
            </div>
          )}
        </div>

        {/* Dynamic Criteria */}
        {isDynamic && (
          <div className="space-y-4 rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              {t("segments.section.criteria")}
            </h2>
            <p className="text-sm text-gray-500">
              {t("segments.criteriaDesc")}
            </p>

            {/* Status filter */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                {t("segments.criteria.status")}
              </label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => handleCriteriaStatusToggle(status)}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                      criteria.status?.includes(status)
                        ? "border-orange-300 bg-orange-100 text-orange-800"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {t(`status.${status.toLowerCase()}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Type filter */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                {t("segments.criteria.type")}
              </label>
              <div className="flex flex-wrap gap-2">
                {TYPE_OPTIONS.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleCriteriaTypeToggle(type)}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                      criteria.type?.includes(type)
                        ? "border-orange-300 bg-orange-100 text-orange-800"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {t(`membershipType.${type.toLowerCase()}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Member since */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("segments.criteria.memberSinceFrom")}
                </label>
                <input
                  type="date"
                  value={criteria.memberSince?.from ?? ""}
                  onChange={(e) =>
                    setCriteria((prev) => ({
                      ...prev,
                      memberSince: {
                        ...prev.memberSince,
                        from: e.target.value || undefined,
                      },
                    }))
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("segments.criteria.memberSinceTo")}
                </label>
                <input
                  type="date"
                  value={criteria.memberSince?.to ?? ""}
                  onChange={(e) =>
                    setCriteria((prev) => ({
                      ...prev,
                      memberSince: {
                        ...prev.memberSince,
                        to: e.target.value || undefined,
                      },
                    }))
                  }
                  className={inputClass}
                />
              </div>
            </div>

            {/* City / Country */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("segments.criteria.city")}
                </label>
                <input
                  type="text"
                  value={criteria.city ?? ""}
                  onChange={(e) =>
                    setCriteria((prev) => ({
                      ...prev,
                      city: e.target.value || undefined,
                    }))
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("segments.criteria.country")}
                </label>
                <input
                  type="text"
                  value={criteria.country ?? ""}
                  onChange={(e) =>
                    setCriteria((prev) => ({
                      ...prev,
                      country: e.target.value || undefined,
                    }))
                  }
                  className={inputClass}
                />
              </div>
            </div>

            {/* Preview Button */}
            <button
              type="button"
              onClick={() => onPreview(JSON.stringify(criteria))}
              disabled={previewing}
              className="inline-flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-100 disabled:opacity-50"
            >
              {previewing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-orange-600"></div>
                  {t("common.loading")}
                </>
              ) : (
                <>
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
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                  {t("segments.action.preview")}
                </>
              )}
            </button>

            {/* Preview Results */}
            {preview && (
              <div className="rounded-lg border bg-gray-50 p-4">
                <p className="mb-2 text-sm font-medium text-gray-900">
                  {t("segments.previewResult", { count: preview.totalCount })}
                </p>
                {preview.preview.length > 0 && (
                  <ul className="space-y-1">
                    {preview.preview.map((m) => (
                      <li key={m.id} className="text-sm text-gray-700">
                        {m.firstName} {m.lastName} — {m.email}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href={cancelHref}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            {t("common.cancel")}
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-orange-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700 disabled:opacity-50"
          >
            {pending ? t(submitPendingLabel) : t(submitIdleLabel)}
          </button>
        </div>
      </form>
    </>
  );
}
