"use client";

/**
 * Tax Codes content (E26-S6 migration of `app/finance/settings/tax-codes/page.tsx`).
 * Composition root (only `"use client"`) — self-embeds its own `QueryClientProvider`.
 *
 * Behaviour preserved AS-IS (A56, the E26-S1 tax-codes net is the oracle):
 *   - Guard: `if (authLoading || loading) return <loading>`; NO `!canReadFinance` early-return —
 *     `loading` starts true and only clears via the guarded fetch, so a non-read user is stuck on
 *     tc("loading") and fires no GET (preserve AS-IS).
 *   - `{ items }` GET envelope. MODAL delete (red confirm). Write-gated add/edit/delete.
 *   - rate ×100 (display) / ÷100 (wire) round-trip (load-bearing): the table renders `rate*100`,
 *     the edit form loads `rate*100`, SAVE submits `rate/100` (the hook owns the ÷100).
 *   - A92: the modal closes from the mutation OUTCOME (`onSuccess`); a failed save keeps it open.
 */

import { useState } from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PageShell } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import {
  useDeleteTaxCode,
  useSaveTaxCode,
  useTaxCodesQuery,
} from "../../hooks/use-tax-codes-admin";
import {
  taxCodeFormSchema,
  type TaxCodeFormValues,
} from "../../schemas/tax-code.schema";
import type { TaxCode } from "../../types/settings.types";

const DEFAULT_VALUES: TaxCodeFormValues = {
  code: "",
  label: "",
  rate: 0,
  isDefault: false,
};

const inputClass =
  "w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500";

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

const TaxIcon = ({ className }: { className?: string }) => (
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
      d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"
    />
  </svg>
);

interface TaxCodeFormProps {
  defaultValues: TaxCodeFormValues;
  editing: boolean;
  saving: boolean;
  onSubmit: (values: TaxCodeFormValues) => void;
  onClose: () => void;
}

/** The shared create/edit tax-code form (RHF + Zod). Rate is the human percentage (×100). */
function TaxCodeForm({
  defaultValues,
  editing,
  saving,
  onSubmit,
  onClose,
}: TaxCodeFormProps) {
  const ttc = useTranslations("finance.taxCodes");
  const t = useTranslations("finance");
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<TaxCodeFormValues>({
    resolver: zodResolver(taxCodeFormSchema),
    defaultValues,
  });
  // The god-page disabled-gate: !form.code || !form.label.
  const code = useWatch({ control, name: "code" });
  const label = useWatch({ control, name: "label" });

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {editing ? ttc("editTaxCode") : ttc("addTaxCode")}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <XIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Code */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            {ttc("code")}
            <span className="ml-1 text-red-500">*</span>
          </label>
          <input
            type="text"
            className={inputClass}
            placeholder={ttc("codePlaceholder")}
            {...register("code")}
          />
          {errors.code && (
            <p className="mt-1 text-sm text-red-600">
              {t(errors.code.message ?? "")}
            </p>
          )}
        </div>

        {/* Label */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            {ttc("label")}
            <span className="ml-1 text-red-500">*</span>
          </label>
          <input
            type="text"
            className={inputClass}
            placeholder={ttc("labelPlaceholder")}
            {...register("label")}
          />
          {errors.label && (
            <p className="mt-1 text-sm text-red-600">
              {t(errors.label.message ?? "")}
            </p>
          )}
        </div>

        {/* Rate (human percentage; the hook divides by 100 for the wire) */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            {ttc("rate")}
            <span className="ml-1 text-red-500">*</span>
          </label>
          <input
            type="number"
            min={0}
            step={0.01}
            className={inputClass}
            placeholder={ttc("ratePlaceholder")}
            {...register("rate", { valueAsNumber: true })}
          />
        </div>

        {/* IsDefault */}
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            {...register("isDefault")}
          />
          <span className="text-sm text-gray-700">{ttc("isDefault")}</span>
        </label>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={saving || !code || !label}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? t("saving") : t("save")}
        </button>
      </div>
    </form>
  );
}

function TaxCodesBody() {
  const t = useTranslations("finance");
  const ttc = useTranslations("finance.taxCodes");
  const tc = useTranslations("common");
  const { canReadFinance, canWriteFinance, isLoading: authLoading } = useAuth();

  const taxCodesQuery = useTaxCodesQuery(!authLoading && canReadFinance);
  const taxCodes = taxCodesQuery.data ?? [];
  // A56: `loading` starts true and only clears via the guarded fetch — a non-read user stays here.
  const loading = authLoading || !canReadFinance || taxCodesQuery.isPending;

  const saveTaxCode = useSaveTaxCode();
  const deleteTaxCode = useDeleteTaxCode();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formDefaults, setFormDefaults] =
    useState<TaxCodeFormValues>(DEFAULT_VALUES);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadError = taxCodesQuery.isError
    ? (taxCodesQuery.error as Error).message
    : null;
  const banner = error ?? loadError;

  const openCreate = () => {
    setEditingId(null);
    setFormDefaults(DEFAULT_VALUES);
    setDialogOpen(true);
  };

  const openEdit = (code: TaxCode) => {
    setEditingId(code.id);
    setFormDefaults({
      code: code.code,
      label: code.label,
      rate: code.rate * 100, // ×100 display in the form
      isDefault: code.isDefault,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setFormDefaults(DEFAULT_VALUES);
  };

  const handleSubmit = (values: TaxCodeFormValues) => {
    if (!canWriteFinance) return;
    setError(null);
    setSuccess(null);
    saveTaxCode.mutate(
      { id: editingId, values },
      {
        onSuccess: () => {
          setSuccess(editingId ? ttc("updateSuccess") : ttc("createSuccess"));
          closeDialog();
        },
        onError: () => setError(t("saveError")),
      }
    );
  };

  const handleDelete = (id: string) => {
    if (!canWriteFinance) return;
    setError(null);
    setSuccess(null);
    deleteTaxCode.mutate(id, {
      onSuccess: () => {
        setSuccess(ttc("deleteSuccess"));
        setConfirmDeleteId(null);
      },
      onError: () => setError(t("deleteError")),
    });
  };

  const filteredTaxCodes = taxCodes.filter((code) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      code.code.toLowerCase().includes(term) ||
      code.label.toLowerCase().includes(term) ||
      (code.rate * 100).toFixed(2).includes(term)
    );
  });

  if (loading) {
    return (
      <PageShell maxWidth="4xl">
        <p className="text-gray-500">{tc("loading")}</p>
      </PageShell>
    );
  }

  const saving = saveTaxCode.isPending;
  const deleting = deleteTaxCode.isPending;

  return (
    <PageShell maxWidth="4xl">
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
        {t("backToSettings")}
      </Link>

      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
            {ttc("title")}
          </h1>
          <p className="mt-1 text-gray-600">{ttc("subtitle")}</p>
        </div>
        {canWriteFinance && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700"
          >
            <PlusIcon className="h-5 w-5" />
            {ttc("addTaxCode")}
          </button>
        )}
      </div>

      {/* Search */}
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
            placeholder={ttc("searchTaxCodes")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-10 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      {/* Alerts */}
      {banner && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{banner}</p>
        </div>
      )}
      {success && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {/* Tax Codes Table */}
      {filteredTaxCodes.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100">
            <TaxIcon className="h-6 w-6 text-orange-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">
            {ttc("noTaxCodes")}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {ttc("noTaxCodesDescription")}
          </p>
          {canWriteFinance && (
            <button
              onClick={openCreate}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700"
            >
              <PlusIcon className="h-5 w-5" />
              {ttc("addTaxCode")}
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    {ttc("code")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    {ttc("label")}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                    {ttc("rate")}
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium tracking-wider text-gray-500 uppercase">
                    {ttc("isDefault")}
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium tracking-wider text-gray-500 uppercase">
                    {t("status")}
                  </th>
                  {canWriteFinance && (
                    <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                      {t("actions")}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredTaxCodes.map((code) => (
                  <tr
                    key={code.id}
                    className="transition-colors hover:bg-gray-50"
                  >
                    <td className="px-6 py-4 text-sm font-medium whitespace-nowrap text-gray-900">
                      {code.code}
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-700">
                      {code.label}
                    </td>
                    <td className="px-6 py-4 text-right text-sm whitespace-nowrap text-gray-700">
                      {(code.rate * 100).toFixed(2)}%
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      {code.isDefault && (
                        <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">
                          {ttc("isDefault")}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          code.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {code.isActive ? t("active") : t("inactive")}
                      </span>
                    </td>
                    {canWriteFinance && (
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(code)}
                            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                            title={ttc("editTaxCode")}
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(code.id)}
                            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
                            title={t("delete")}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <TaxCodeForm
            key={editingId ?? "new"}
            defaultValues={formDefaults}
            editing={editingId !== null}
            saving={saving}
            onSubmit={handleSubmit}
            onClose={closeDialog}
          />
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">
              {t("confirmDelete")}
            </h2>
            <p className="mt-2 text-sm text-gray-600">{ttc("confirmDelete")}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                {t("cancel")}
              </button>
              <button
                onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? tc("loading") : t("delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

export function TaxCodesContent() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <TaxCodesBody />
    </QueryClientProvider>
  );
}
