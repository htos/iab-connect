"use client";

/**
 * Transaction create/edit form (E26-S5) — the E22 RHF+Zod sub-recipe applied to the
 * transactions god-page's create/edit modal.
 *
 * A95: the type/account/category/activity-area `<select>`s are closed sets seeded from
 *   the lookups; `defaultValues` carry the RAW stored value so an out-of-set / now-inactive
 *   account renders blank-but-retained on edit (no `z.enum(renderedSubset)` — account/
 *   category/activityArea are `z.string()`).
 * A96: the schema does NOT `.trim()`; the SUBMIT handler trims description/reference/notes
 *   exactly as the god-page's `handleSubmit` did (`form.description.trim()`,
 *   `form.reference.trim() || null`, `form.notes.trim() || null`) — byte-identical payload.
 * Required-ness MATCHES the god-page's enable-gate: description + amount≥0.01 + accountId +
 *   categoryId (+ date, defaulted). `<form noValidate>` surfaces per-field Zod errors.
 */

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  buildTransactionSchema,
  type TransactionFormValues,
} from "../../schemas/transaction.schema";
import type {
  TransactionActivityArea,
  TransactionAccount,
  TransactionCategory,
  TransactionPayload,
} from "../../types/banking.types";

export function TransactionForm({
  isEditing,
  defaultValues,
  accounts,
  categories,
  activityAreas,
  saving,
  formError,
  onSubmitPayload,
  onCancel,
}: {
  isEditing: boolean;
  defaultValues: TransactionFormValues;
  accounts: TransactionAccount[];
  categories: TransactionCategory[];
  activityAreas: TransactionActivityArea[];
  saving: boolean;
  formError: string | null;
  onSubmitPayload: (payload: TransactionPayload) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("finance");
  const schema = useMemo(() => buildTransactionSchema(t), [t]);
  const { register, handleSubmit } = useForm<TransactionFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const onSubmit = (values: TransactionFormValues) => {
    // A96 — trim description/reference/notes at payload-build time, byte-identical to the
    // god-page's `handleSubmit` (the rendered/edited bytes stay untouched).
    const payload: TransactionPayload = {
      date: values.date,
      description: values.description.trim(),
      amount: parseFloat(values.amount),
      type: values.type,
      accountId: values.accountId,
      categoryId: values.categoryId,
      reference: values.reference.trim() || null,
      notes: values.notes.trim() || null,
      activityAreaId: values.activityAreaId || null,
    };
    onSubmitPayload(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          {isEditing ? t("editTransaction") : t("newTransaction")}
        </h2>

        {formError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {formError}
          </div>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-4"
        >
          {/* Date */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("date")} *
            </label>
            <input
              type="date"
              {...register("date")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("description")} *
            </label>
            <input
              type="text"
              {...register("description")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
            />
          </div>

          {/* Amount + Type row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("amount")} *
              </label>
              <input
                type="number"
                {...register("amount")}
                min="0.01"
                step="0.01"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("type")} *
              </label>
              <select
                {...register("type")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
              >
                <option value="Income">{t("income")}</option>
                <option value="Expense">{t("expense")}</option>
              </select>
            </div>
          </div>

          {/* Account + Category row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("account")} *
              </label>
              <select
                {...register("accountId")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
              >
                <option value="">{t("account")}…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("category")} *
              </label>
              <select
                {...register("categoryId")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
              >
                <option value="">{t("category")}…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Reference */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("reference")}
            </label>
            <input
              type="text"
              {...register("reference")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
            />
          </div>

          {/* Activity Area */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("activityArea")}
            </label>
            <select
              {...register("activityAreaId")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
            >
              <option value="">{t("noActivityArea")}</option>
              {activityAreas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("notes")}
            </label>
            <textarea
              {...register("notes")}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
            >
              {saving ? "…" : t("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
