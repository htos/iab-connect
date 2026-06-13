"use client";

/**
 * Activity Areas content (E26-S4 migration of `app/finance/activity-areas/page.tsx`).
 * Composition root — self-embeds its own `QueryClientProvider`.
 *
 * Guard (pinned AS-IS): `authLoading || loading` pulse skeleton → `if (!canReadFinance)
 * return null` (NO redirect; a read-denied cold session stays on the skeleton because
 * `loading` inits true + the GET is guard-gated — the invariant is NO finance GET fires).
 * manage + report tabs. toggle-active = PUT same /{id} (isActive flipped). INLINE two-step
 * confirm delete. HARDCODED-ENGLISH error strings preserved verbatim. Page-local
 * `formatCurrency` (de-CH, NO symbol) preserved. A92 dialog close from mutation OUTCOME.
 */

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  useActivityAreasList,
  useSaveActivityArea,
  useToggleActivityAreaActive,
  useDeleteActivityArea,
  useActivityAreaReport,
} from "../../hooks/use-activity-areas-crud";
import { ActivityAreaForm } from "./activity-area-form";
import type { ActivityAreaFormSchemaValues } from "../../schemas/activity-area.schema";
import type { ActivityArea } from "../../types/budgeting.types";

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

// Page-local de-CH formatter (NO currency symbol) — preserved verbatim (NOT @/lib/utils,
// which renders a currency symbol; S1 pins "1’234.50" / "500.00").
function formatCurrency(value: number): string {
  return value.toLocaleString("de-CH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const DEFAULT_FORM: ActivityAreaFormSchemaValues = {
  name: "",
  code: "",
  description: "",
  color: "",
  sortOrder: 0,
  isActive: true,
};

function ActivityAreasBody() {
  const t = useTranslations("activityAreas");
  const tf = useTranslations("finance");
  const tr = useTranslations("activityAreas.report");
  const tc = useTranslations("common");
  const { canReadFinance, canWriteFinance, isLoading: authLoading } = useAuth();

  const listEnabled = !authLoading && canReadFinance;
  const areasQuery = useActivityAreasList(listEnabled);
  const areas = areasQuery.data ?? [];
  // `loading` mirrors the god-page's init-true state: true until a fetch SETTLES. A disabled
  // query (read-denied / authLoading) never settles → `isFetched` stays false → the skeleton
  // wins (the read-denied cold session stays on the skeleton, never reaching `return null` —
  // pinned AS-IS; the load-bearing invariant is that NO finance GET fires).
  const loading = !areasQuery.isFetched;

  const saveArea = useSaveActivityArea();
  const toggleActive = useToggleActivityAreaActive();
  const deleteArea = useDeleteActivityArea();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formDefaults, setFormDefaults] =
    useState<ActivityAreaFormSchemaValues>(DEFAULT_FORM);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"manage" | "report">("manage");
  const [reportFrom, setReportFrom] = useState(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]
  );
  const [reportTo, setReportTo] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [reportParams, setReportParams] = useState<{
    from: string;
    to: string;
    fetch: boolean;
  }>({ from: reportFrom, to: reportTo, fetch: false });

  const reportQuery = useActivityAreaReport(reportParams);
  const reportRows = reportQuery.data ?? [];
  const reportLoading = reportQuery.isFetching;
  const reportFetched = reportQuery.isFetched && reportParams.fetch;

  // The list-load error maps to res.error (the god-page sets `error` on res.error).
  const listError = areasQuery.isError
    ? (areasQuery.error as Error).message
    : null;

  const openCreate = () => {
    setEditingId(null);
    setFormDefaults(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEdit = (area: ActivityArea) => {
    setEditingId(area.id);
    setFormDefaults({
      name: area.name,
      code: area.code,
      description: area.description ?? "",
      color: area.color ?? "",
      sortOrder: area.sortOrder,
      isActive: area.isActive,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setFormDefaults(DEFAULT_FORM);
  };

  const handleSubmit = (values: ActivityAreaFormSchemaValues) => {
    if (!canWriteFinance) return;
    setError(null);
    setSuccess(null);
    saveArea.mutate(
      { editingId, ...values },
      {
        onSuccess: () => {
          setSuccess(editingId ? t("updateSuccess") : t("createSuccess"));
          closeDialog();
        },
        // HARDCODED-ENGLISH — preserved verbatim (do NOT translate).
        onError: () => setError("Failed to save activity area"),
      }
    );
  };

  const handleToggleActive = (area: ActivityArea) => {
    if (!canWriteFinance) return;
    setError(null);
    setSuccess(null);
    toggleActive.mutate(area, {
      onSuccess: () => setSuccess(t("updateSuccess")),
      onError: () => setError("Failed to toggle activity area status"),
    });
  };

  const handleDelete = (id: string) => {
    if (!canWriteFinance) return;
    setError(null);
    setSuccess(null);
    deleteArea.mutate(id, {
      onSuccess: () => {
        setSuccess(t("deleteSuccess"));
        setConfirmDeleteId(null);
      },
      // HARDCODED-ENGLISH; confirm STAYS armed on failure.
      onError: () => setError("Failed to delete activity area"),
    });
  };

  const handleReportFilter = () => {
    setError(null);
    setReportParams({ from: reportFrom, to: reportTo, fetch: true });
  };

  // Report load error → hardcoded-English (the god-page sets it in the report catch).
  const reportError = reportQuery.isError ? "Failed to load report" : null;
  const banner = error ?? listError ?? reportError;

  const totalIncome = reportRows.reduce((sum, r) => sum + r.totalIncome, 0);
  const totalExpense = reportRows.reduce((sum, r) => sum + r.totalExpense, 0);
  const totalBalance = reportRows.reduce((sum, r) => sum + r.balance, 0);

  const filteredAreas = areas.filter((area) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      area.name.toLowerCase().includes(term) ||
      area.code.toLowerCase().includes(term) ||
      (area.description?.toLowerCase().includes(term) ?? false)
    );
  });

  if (authLoading || loading) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
        <div className="mx-auto max-w-6xl">
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

  const deleting = deleteArea.isPending;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Back to Settings */}
        <Link
          href="/finance/settings"
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
          {tf("backToSettings")}
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
            <p className="mt-1 text-sm text-gray-500">{t("subtitle")}</p>
          </div>
          {canWriteFinance && activeTab === "manage" && (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700"
            >
              <PlusIcon className="h-4 w-4" />
              {t("addActivityArea")}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex gap-6">
            <button
              onClick={() => setActiveTab("manage")}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                activeTab === "manage"
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {t("manageActivityAreas")}
            </button>
            <button
              onClick={() => setActiveTab("report")}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                activeTab === "report"
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {tr("title")}
            </button>
          </nav>
        </div>

        {/* Messages */}
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

        {/* ====== MANAGE TAB ====== */}
        {activeTab === "manage" && (
          <>
            <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
              <div className="relative">
                <svg
                  className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder={t("searchActivityAreas")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-10 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
            <div className="overflow-hidden rounded-xl bg-white shadow-sm">
              {filteredAreas.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-lg font-medium text-gray-900">
                    {t("noActivityAreas")}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {t("noActivityAreasDescription")}
                  </p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        {t("code")}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        {t("name")}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        {t("description")}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        {t("color")}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        {t("sortOrder")}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        {t("isActive")}
                      </th>
                      {canWriteFinance && (
                        <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                          {tc("actions")}
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filteredAreas.map((area) => (
                      <tr
                        key={area.id}
                        className={`hover:bg-gray-50 ${!area.isActive ? "opacity-60" : ""}`}
                      >
                        <td className="px-6 py-4 font-mono text-sm font-medium whitespace-nowrap text-gray-900">
                          {area.code}
                        </td>
                        <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                          {area.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {area.description ?? "—"}
                        </td>
                        <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                          {area.color ? (
                            <span className="inline-flex items-center gap-2">
                              <span
                                className="inline-block h-4 w-4 rounded"
                                style={{ backgroundColor: area.color }}
                              />
                              <span className="font-mono text-xs">
                                {area.color}
                              </span>
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                          {area.sortOrder}
                        </td>
                        <td className="px-6 py-4 text-sm whitespace-nowrap">
                          {canWriteFinance ? (
                            <button
                              onClick={() => handleToggleActive(area)}
                              className={`inline-flex cursor-pointer rounded-full px-2 text-xs leading-5 font-semibold transition-colors ${
                                area.isActive
                                  ? "bg-green-100 text-green-800 hover:bg-green-200"
                                  : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                              }`}
                              title={
                                area.isActive ? t("deactivate") : t("activate")
                              }
                            >
                              {area.isActive ? tc("yes") : tc("no")}
                            </button>
                          ) : (
                            <span
                              className={`inline-flex rounded-full px-2 text-xs leading-5 font-semibold ${
                                area.isActive
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {area.isActive ? tc("yes") : tc("no")}
                            </span>
                          )}
                        </td>
                        {canWriteFinance && (
                          <td className="px-6 py-4 text-right text-sm whitespace-nowrap">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => openEdit(area)}
                                className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-orange-600"
                                title={tc("edit")}
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              {confirmDeleteId === area.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleDelete(area.id)}
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
                                  onClick={() => setConfirmDeleteId(area.id)}
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
          </>
        )}

        {/* ====== REPORT TAB ====== */}
        {activeTab === "report" && (
          <>
            {/* Filter */}
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {tr("from")}
                  </label>
                  <input
                    type="date"
                    value={reportFrom}
                    onChange={(e) => setReportFrom(e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {tr("to")}
                  </label>
                  <input
                    type="date"
                    value={reportTo}
                    onChange={(e) => setReportTo(e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
                <button
                  onClick={handleReportFilter}
                  disabled={reportLoading}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700 disabled:opacity-50"
                >
                  {reportLoading ? tc("loading") : tr("filter")}
                </button>
              </div>
            </div>

            {/* Report Table */}
            {reportFetched && (
              <div className="overflow-hidden rounded-xl bg-white shadow-sm">
                {reportRows.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="text-lg font-medium text-gray-900">
                      {tr("noData")}
                    </p>
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                          {tr("activityArea")}
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                          {tr("income")}
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                          {tr("expense")}
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                          {tr("balance")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {reportRows.map((row, idx) => (
                        <tr
                          key={row.activityAreaId ?? `unassigned-${idx}`}
                          className="hover:bg-gray-50"
                        >
                          <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                            {row.activityAreaCode ? (
                              <span>
                                <span className="font-mono font-medium">
                                  {row.activityAreaCode}
                                </span>
                                {" — "}
                                {row.activityAreaName}
                              </span>
                            ) : (
                              <span className="text-gray-500 italic">
                                {tr("unassigned")}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right text-sm whitespace-nowrap text-green-700">
                            {formatCurrency(row.totalIncome)}
                          </td>
                          <td className="px-6 py-4 text-right text-sm whitespace-nowrap text-red-700">
                            {formatCurrency(row.totalExpense)}
                          </td>
                          <td
                            className={`px-6 py-4 text-right text-sm font-semibold whitespace-nowrap ${
                              row.balance >= 0
                                ? "text-green-700"
                                : "text-red-700"
                            }`}
                          >
                            {formatCurrency(row.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-gray-300 bg-gray-50">
                      <tr className="font-semibold">
                        <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                          {tr("total")}
                        </td>
                        <td className="px-6 py-4 text-right text-sm whitespace-nowrap text-green-700">
                          {formatCurrency(totalIncome)}
                        </td>
                        <td className="px-6 py-4 text-right text-sm whitespace-nowrap text-red-700">
                          {formatCurrency(totalExpense)}
                        </td>
                        <td
                          className={`px-6 py-4 text-right text-sm whitespace-nowrap ${
                            totalBalance >= 0
                              ? "text-green-700"
                              : "text-red-700"
                          }`}
                        >
                          {formatCurrency(totalBalance)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            )}
          </>
        )}

        {/* Create/Edit Dialog */}
        {dialogOpen && (
          <ActivityAreaForm
            editing={!!editingId}
            defaultValues={formDefaults}
            pending={saveArea.isPending}
            onSubmit={handleSubmit}
            onClose={closeDialog}
          />
        )}
      </div>
    </main>
  );
}

export function ActivityAreasContent() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <ActivityAreasBody />
    </QueryClientProvider>
  );
}
