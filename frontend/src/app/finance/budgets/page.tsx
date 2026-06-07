"use client";

/**
 * Budget Management Page
 * REQ-044 (E6-S1): Finance Planning — budget amount per cost center (ActivityArea) per fiscal period.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth, useApiClient } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import {
  BUDGETS_ENDPOINT,
  type BudgetDto,
  type FinanceCurrency,
} from "@/lib/api/budgets";

// --- Types ---

interface ActivityAreaOption {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

interface FiscalPeriodOption {
  id: string;
  name: string;
  year: number;
  month: number;
}

interface BudgetForm {
  activityAreaId: string;
  fiscalPeriodId: string;
  amount: string;
  currency: FinanceCurrency;
  notes: string;
}

const DEFAULT_FORM: BudgetForm = {
  activityAreaId: "",
  fiscalPeriodId: "",
  amount: "",
  currency: "CHF",
  notes: "",
};

// --- Icons ---

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

// --- Component ---

export default function BudgetsPage() {
  const t = useTranslations("budgets");
  const tc = useTranslations("common");
  const tf = useTranslations("finance");
  const { canReadFinance, canWriteFinance, isLoading: authLoading } = useAuth();
  const api = useApiClient();

  const apiRef = useRef(api);
  apiRef.current = api;

  const [budgets, setBudgets] = useState<BudgetDto[]>([]);
  const [areas, setAreas] = useState<ActivityAreaOption[]>([]);
  const [periods, setPeriods] = useState<FiscalPeriodOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [filterAreaId, setFilterAreaId] = useState("");
  const [filterPeriodId, setFilterPeriodId] = useState("");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BudgetForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // --- Data fetching ---

  const fetchSelectors = useCallback(async () => {
    const [areaRes, periodRes] = await Promise.all([
      apiRef.current.get<unknown>("/api/v1/finance/activity-areas"),
      apiRef.current.get<unknown>("/api/v1/finance/fiscal-periods"),
    ]);
    if (areaRes.data) {
      const body = areaRes.data as { items?: ActivityAreaOption[] };
      setAreas((body.items ?? []).filter((a) => a.isActive));
    }
    if (periodRes.data) {
      const body = periodRes.data as { items?: FiscalPeriodOption[] };
      setPeriods(body.items ?? []);
    }
  }, []);

  const fetchBudgets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterAreaId) params.set("activityAreaId", filterAreaId);
      if (filterPeriodId) params.set("fiscalPeriodId", filterPeriodId);
      const qs = params.toString();
      const response = await apiRef.current.get<BudgetDto[]>(
        qs ? `${BUDGETS_ENDPOINT}?${qs}` : BUDGETS_ENDPOINT
      );
      if (response.error) {
        setError(response.error);
      } else {
        setBudgets(response.data ?? []);
      }
    } catch {
      setError(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [filterAreaId, filterPeriodId, t]);

  useEffect(() => {
    if (!authLoading && canReadFinance) {
      fetchSelectors();
    }
  }, [authLoading, canReadFinance, fetchSelectors]);

  useEffect(() => {
    if (!authLoading && canReadFinance) {
      fetchBudgets();
    }
  }, [authLoading, canReadFinance, fetchBudgets]);

  // --- Dialog handlers ---

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...DEFAULT_FORM, currency: "CHF" });
    setDialogOpen(true);
  };

  const openEdit = (budget: BudgetDto) => {
    setEditingId(budget.id);
    setForm({
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
    setForm(DEFAULT_FORM);
  };

  const handleSave = async () => {
    if (!canWriteFinance) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const amount = parseFloat(form.amount);

    try {
      if (editingId) {
        const response = await apiRef.current.put(
          `${BUDGETS_ENDPOINT}/${editingId}`,
          {
            amount,
            currency: form.currency,
            notes: form.notes || null,
          }
        );
        if (response.error) throw new Error(response.error);
        setSuccess(t("updateSuccess"));
      } else {
        const response = await apiRef.current.post(BUDGETS_ENDPOINT, {
          activityAreaId: form.activityAreaId,
          fiscalPeriodId: form.fiscalPeriodId,
          amount,
          currency: form.currency,
          notes: form.notes || null,
        });
        if (response.error) throw new Error(response.error);
        setSuccess(t("createSuccess"));
      }
      closeDialog();
      await fetchBudgets();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  // --- Delete handler ---

  const handleDelete = async (id: string) => {
    if (!canWriteFinance) return;
    setDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiRef.current.delete(`${BUDGETS_ENDPOINT}/${id}`);
      if (response.error) throw new Error(response.error);
      setSuccess(t("deleteSuccess"));
      setConfirmDeleteId(null);
      await fetchBudgets();
    } catch {
      setError(t("deleteError"));
    } finally {
      setDeleting(false);
    }
  };

  // --- Render ---

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

  const formValid =
    !!form.activityAreaId &&
    !!form.fiscalPeriodId &&
    form.amount.trim() !== "" &&
    !isNaN(parseFloat(form.amount)) &&
    parseFloat(form.amount) >= 0;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Back link */}
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

        {/* Header */}
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

        {/* Messages */}
        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {error}
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

        {/* Create/Edit Dialog */}
        {dialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingId ? t("editBudget") : t("addBudget")}
                </h2>
                <button
                  onClick={closeDialog}
                  aria-label={tc("close")}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("costCenter")} *
                  </label>
                  <select
                    value={form.activityAreaId}
                    onChange={(e) =>
                      setForm({ ...form, activityAreaId: e.target.value })
                    }
                    disabled={!!editingId}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none disabled:bg-gray-100"
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
                    value={form.fiscalPeriodId}
                    onChange={(e) =>
                      setForm({ ...form, fiscalPeriodId: e.target.value })
                    }
                    disabled={!!editingId}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none disabled:bg-gray-100"
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
                      value={form.amount}
                      onChange={(e) =>
                        setForm({ ...form, amount: e.target.value })
                      }
                      placeholder="0.00"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t("currency")}
                    </label>
                    <select
                      value={form.currency}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          currency: e.target.value as FinanceCurrency,
                        })
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
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
                    value={form.notes}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                    placeholder={t("notesPlaceholder")}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={closeDialog}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  {tc("cancel")}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formValid}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
                >
                  {saving ? tc("saving") : tc("save")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
