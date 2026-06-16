"use client";

/**
 * Retention policy edit form (E27-S4, DEC-2 = RHF+Zod form sub-recipe). Rendered
 * inline inside a policy card when that policy is being edited.
 *
 * Behaviour preserved verbatim (pinned by the E27-S1 retention net): the four
 * editable fields (displayName text, retentionMonths number ≥ 1, action select
 * Anonymize/Archive/Delete, legalBasis text) + the isActive checkbox;
 * `dataCategory` is READ-ONLY (absent from the form). The labels are NOT wired via
 * htmlFor/id (the net's `controlForLabel` helper reads the control inside the
 * wrapping `<div>` — do not add ids). On submit the parsed values build the
 * `UpdateRetentionPolicyRequest` (A96: NO `.trim()` — submitted byte-identical;
 * `legalBasis` "" → null, matching the god-page's `value || null`).
 *
 * A95: the action `<select>` OFFERS 3 options but renders an EXTRA `<option>` for
 * an out-of-set stored value so a native select round-trips it unchanged. The new
 * `isSaving` guard (the god-page lacked one) blocks double-submit (`noValidate`
 * renders Zod field errors).
 */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import {
  RETENTION_ACTIONS,
  retentionFormSchema,
  type RetentionFormValues,
} from "../schemas/retention.schema";
import type {
  RetentionPolicyDto,
  UpdateRetentionPolicyRequest,
} from "../types/retention.types";

const FIELD_CLASS =
  "w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500";

interface RetentionFormProps {
  policy: RetentionPolicyDto;
  isSaving: boolean;
  onSubmit: (data: UpdateRetentionPolicyRequest) => void;
  onCancel: () => void;
}

/** Map RHF values → transport request (god-page parity: `legalBasis || null`). */
function toRequest(values: RetentionFormValues): UpdateRetentionPolicyRequest {
  return {
    displayName: values.displayName,
    retentionMonths: values.retentionMonths,
    action: values.action,
    legalBasis: values.legalBasis || null,
    isActive: values.isActive,
  };
}

export function RetentionForm({
  policy,
  isSaving,
  onSubmit,
  onCancel,
}: RetentionFormProps) {
  const t = useTranslations("admin.retention");
  const tCommon = useTranslations("common");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RetentionFormValues>({
    resolver: zodResolver(retentionFormSchema),
    defaultValues: {
      displayName: policy.displayName,
      retentionMonths: policy.retentionMonths,
      action: policy.action as RetentionFormValues["action"],
      legalBasis: policy.legalBasis ?? "",
      isActive: policy.isActive,
    },
  });

  // A stored action outside the offered 3-option set must still display + round-
  // trip; a native select whose value matches no <option> reports value="" on
  // submit. Rendering an extra option for an out-of-set current value preserves it.
  // eslint-disable-next-line react-hooks/incompatible-library
  const action = watch("action");
  const extraAction =
    action && !RETENTION_ACTIONS.includes(action as never) ? action : null;

  return (
    <form
      onSubmit={handleSubmit((values) => onSubmit(toRequest(values)))}
      noValidate
      className="space-y-4"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("fields.displayName")}
          </label>
          <input
            type="text"
            className={FIELD_CLASS}
            {...register("displayName")}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("fields.retentionMonths")}
          </label>
          <input
            type="number"
            min="1"
            className={FIELD_CLASS}
            {...register("retentionMonths")}
          />
          {errors.retentionMonths && (
            <p className="mt-1 text-sm text-red-600" role="alert">
              {t(
                errors.retentionMonths.message ??
                  "validation.retentionMonthsMin"
              )}
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("fields.action")}
          </label>
          <select className={FIELD_CLASS} {...register("action")}>
            <option value="Anonymize">{t("actions.anonymize")}</option>
            <option value="Archive">{t("actions.archive")}</option>
            <option value="Delete">{t("actions.delete")}</option>
            {extraAction && (
              <option value={extraAction}>
                {t(`actions.${extraAction.toLowerCase()}`)}
              </option>
            )}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("fields.legalBasis")}
          </label>
          <input
            type="text"
            className={FIELD_CLASS}
            {...register("legalBasis")}
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            {...register("isActive")}
          />
          {t("fields.active")}
        </label>
      </div>
      <div className="flex justify-end gap-2 border-t pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="rounded-xl bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 disabled:opacity-50"
        >
          {tCommon("cancel")}
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-xl bg-orange-600 px-4 py-2 text-sm text-white hover:bg-orange-700 disabled:opacity-50"
        >
          {tCommon("save")}
        </button>
      </div>
    </form>
  );
}
