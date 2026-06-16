"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import {
  budgetFormSchema,
  type BudgetFormSchemaValues,
} from "../../schemas/budget.schema";
import type {
  ActivityArea,
  FiscalPeriodOption,
} from "../../types/budgeting.types";

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

interface BudgetFormProps {
  editing: boolean;
  defaultValues: BudgetFormSchemaValues;
  areas: ActivityArea[];
  periods: FiscalPeriodOption[];
  pending: boolean;
  onSubmit: (values: BudgetFormSchemaValues) => void;
  onClose: () => void;
}

/**
 * Budget create/edit dialog — RHF + Zod (E22 sub-recipe). The combobox order is
 * [costCenter, period, currency] (the S1 suite reads them as `slice(-3)`). A95:
 * cost-center + period are disabled-on-edit (raw stored value retained via defaultValues);
 * the Zod fields are FULL `z.string()` (never an enum of the rendered subset). The enable
 * gate matches the god-page (both selects + amount≥0) via the schema — Save is also
 * `disabled` while pending. A96: notes is NOT trimmed.
 */
export function BudgetForm({
  editing,
  defaultValues,
  areas,
  periods,
  pending,
  onSubmit,
  onClose,
}: BudgetFormProps) {
  const t = useTranslations("budgets");
  const tc = useTranslations("common");
  const { register, handleSubmit } = useForm<BudgetFormSchemaValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {editing ? t("editBudget") : t("addBudget")}
          </h2>
          <button
            onClick={onClose}
            aria-label={tc("close")}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("costCenter")} *
              </label>
              <select
                disabled={editing}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none disabled:bg-gray-100"
                {...register("activityAreaId")}
              >
                <option value="">{t("selectCostCenter")}</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("period")} *
              </label>
              <select
                disabled={editing}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none disabled:bg-gray-100"
                {...register("fiscalPeriodId")}
              >
                <option value="">{t("selectPeriod")}</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("amount")} *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                  {...register("amount")}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("currency")}
                </label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                  {...register("currency")}
                >
                  <option value="CHF">CHF</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("notes")}
              </label>
              <input
                type="text"
                placeholder={t("notesPlaceholder")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                {...register("notes")}
              />
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
