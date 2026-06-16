"use client";

/**
 * Budgets content (E26-S4 migration of `app/finance/budgets/page.tsx`).
 * Composition root (only `"use client"`) — self-embeds its own `QueryClientProvider`.
 *
 * Guard: `authLoading || loading` pulse skeleton → `if (!canReadFinance) return null` (NO
 * redirect — S1 pins this). Filters drive the server-filtered budgets query
 * (`?activityAreaId=&fiscalPeriodId=`). A95: the dialog area/period selects are
 * disabled-on-edit (raw value retained). A92: the dialog closes from the mutation OUTCOME.
 * Save surfaces the server error VERBATIM (e.message); delete maps to the `deleteError` key
 * and PRESERVES the inline confirm on failure. Every i18n key + URL byte-identical.
 */

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth, useApiClient } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import {
  useBudgets,
  useSaveBudget,
  useDeleteBudget,
} from "../../hooks/use-budgets";
import {
  useActiveActivityAreaOptions,
  useFiscalPeriodOptions,
} from "../../hooks/use-budgeting-selectors";
import { BudgetForm } from "./budget-form";
import type { BudgetFormSchemaValues } from "../../schemas/budget.schema";
import type { BudgetDto } from "../../types/budgeting.types";

const PlusIcon = ({ className }: { className?: string }) => (
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
      d="M12 4v16m8-8H4"
    />
  </svg>
);

const PencilIcon = ({ className }: { className?: string }) => (
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
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
    />
  </svg>
);

const TrashIcon = ({ className }: { className?: string }) => (
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
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

const DEFAULT_FORM: BudgetFormSchemaValues = {
  activityAreaId: "",
  fiscalPeriodId: "",
  amount: "",
  currency: "CHF",
  notes: "",
};

function BudgetsBody() {
  const t = useTranslations("budgets");
  const tc = useTranslations("common");
  const tf = useTranslations("finance");
  const { canReadFinance, canWriteFinance, isLoading: authLoading } = useAuth();
  const api = useApiClient();

  const [filterAreaId, setFilterAreaId] = useState("");
  const [filterPeriodId, setFilterPeriodId] = useState("");

  const selectorsEnabled = !authLoading && canReadFinance;
  const areasQuery = useActiveActivityAreaOptions(selectorsEnabled);
  const periodsQuery = useFiscalPeriodOptions(selectorsEnabled);
  const budgetsQuery = useBudgets(
    { activityAreaId: filterAreaId, fiscalPeriodId: filterPeriodId },
    selectorsEnabled
  );
  const saveBudget = useSaveBudget();
  const deleteBudget = useDeleteBudget();

  const areas = areasQuery.data ?? [];
  const periods = periodsQuery.data ?? [];
  const budgets = budgetsQuery.data ?? [];
  // `loading` mirrors the god-page's init-true state: true until the budgets fetch SETTLES
  // (a disabled query — authLoading / read-denied — never settles → skeleton wins).
  const loading = !budgetsQuery.isFetched;

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formDefaults, setFormDefaults] =
    useState<BudgetFormSchemaValues>(DEFAULT_FORM);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const queryError = budgetsQuery.isError
    ? (budgetsQuery.error as Error).message
    : null;
  const banner = error ?? queryError;

  const openCreate = () => {
    setEditingId(null);
    setFormDefaults({ ...DEFAULT_FORM, currency: "CHF" });
    setDialogOpen(true);
  };

  const openEdit = (budget: BudgetDto) => {
    setEditingId(budget.id);
    setFormDefaults({
      activityAreaId: budget.activityAreaId,
      fiscalPeriodId: budget.fiscalPeriodId,
      amount: String(budget.amount),
      currency: budget.currency,
      notes: budget.notes ?? "",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setFormDefaults(DEFAULT_FORM);
  };

  const handleSubmit = (values: BudgetFormSchemaValues) => {
    if (!canWriteFinance) return;
    setError(null);
    setSuccess(null);
    const amount = parseFloat(values.amount);
    saveBudget.mutate(
      {
        editingId,
        activityAreaId: values.activityAreaId,
        fiscalPeriodId: values.fiscalPeriodId,
        amount,
        currency: values.currency,
        notes: values.notes || null,
      },
      {
        onSuccess: () => {
          setSuccess(editingId ? t("updateSuccess") : t("createSuccess"));
          closeDialog();
        },
        // Save surfaces the server error VERBATIM (e.message), not the i18n key.
        onError: (e) =>
          setError(e instanceof Error ? e.message : t("saveError")),
      }
    );
  };

  const handleDelete = (id: string) => {
    if (!canWriteFinance) return;
    setError(null);
    setSuccess(null);
    deleteBudget.mutate(id, {
      onSuccess: () => {
        setSuccess(t("deleteSuccess"));
        setConfirmDeleteId(null);
      },
      // Delete swallows the thrown message → maps to the deleteError key; confirm STAYS
      // armed on failure (confirmDeleteId is only cleared in onSuccess).
      onError: () => setError(t("deleteError")),
    });
  };

  if (authLoading || loading) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 rounded bg-gray-200" />
            <div className="h-64 rounded-xl bg-gray-200" />
          </div>
        </div>
      </main>
    );
  }

  if (!canReadFinance) {
    return null;
  }

  const deleting = deleteBudget.isPending;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <Link
          href="/finance"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {tf("backToFinance")}
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
            <p className="mt-1 text-sm text-gray-500">{t("subtitle")}</p>
          </div>
          {canWriteFinance && (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700"
            >
              <PlusIcon className="h-4 w-4" />
              {t("addBudget")}
            </button>
          )}
        </div>

        {banner && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {banner}
          </div>
        )}
        {success && (
          <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700">
            {success}
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 grid grid-cols-1 gap-4 rounded-xl bg-white p-4 shadow-sm sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("filterByCostCenter")}
            </label>
            <select
              value={filterAreaId}
              onChange={(e) => setFilterAreaId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
            >
              <option value="">{t("allCostCenters")}</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("filterByPeriod")}
            </label>
            <select
              value={filterPeriodId}
              onChange={(e) => setFilterPeriodId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
            >
              <option value="">{t("allPeriods")}</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          {budgets.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-lg font-medium text-gray-900">
                {t("noBudgets")}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {t("noBudgetsDescription")}
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    {t("costCenter")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    {t("period")}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                    {t("amount")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    {t("notes")}
                  </th>
                  {canWriteFinance && (
                    <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                      {tc("actions")}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {budgets.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                      <span className="font-mono font-medium">
                        {b.activityAreaCode ?? "—"}
                      </span>
                      {b.activityAreaName ? ` — ${b.activityAreaName}` : ""}
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                      {b.fiscalPeriodName ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium whitespace-nowrap text-gray-900">
                      {formatCurrency(b.amount, b.currency)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {b.notes ?? "—"}
                    </td>
                    {canWriteFinance && (
                      <td className="px-6 py-4 text-right text-sm whitespace-nowrap">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEdit(b)}
                            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-orange-600"
                            title={tc("edit")}
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          {confirmDeleteId === b.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(b.id)}
                                disabled={deleting}
                                className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                              >
                                {tc("confirm")}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-300"
                              >
                                {tc("cancel")}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(b.id)}
                              className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-red-600"
                              title={tc("delete")}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {dialogOpen && (
          <BudgetForm
            editing={!!editingId}
            defaultValues={formDefaults}
            areas={areas}
            periods={periods}
            pending={saveBudget.isPending}
            onSubmit={handleSubmit}
            onClose={closeDialog}
          />
        )}
      </div>
    </main>
  );
}

export function BudgetsContent() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <BudgetsBody />
    </QueryClientProvider>
  );
}
