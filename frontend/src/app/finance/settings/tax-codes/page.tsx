"use client";

/**
 * Tax Codes Management Page
 * REQ-062: VAT/MWST Frontend UI
 */

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth, useApiClient } from "@/lib/auth";

// --- Types ---

interface TaxCode {
  id: string;
  code: string;
  label: string;
  rate: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TaxCodeForm {
  code: string;
  label: string;
  rate: number;
  isDefault: boolean;
}

const DEFAULT_FORM: TaxCodeForm = {
  code: "",
  label: "",
  rate: 0,
  isDefault: false,
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

// --- Component ---

export default function TaxCodesPage() {
  const t = useTranslations("finance");
  const ttc = useTranslations("finance.taxCodes");
  const tc = useTranslations("common");
  const { canReadFinance, canWriteFinance, isLoading: authLoading } = useAuth();
  const api = useApiClient();

  const apiRef = useRef(api);
  apiRef.current = api;
  const tRef = useRef(t);
  tRef.current = t;

  const [taxCodes, setTaxCodes] = useState<TaxCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TaxCodeForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // --- Data fetching ---

  const fetchTaxCodes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiRef.current.get<TaxCode[]>(
        "/api/v1/finance/tax-codes"
      );
      if (response.error) {
        setError(response.error);
      } else if (response.data) {
        const body = response.data as unknown as { items: TaxCode[] };
        setTaxCodes(body.items ?? []);
      }
    } catch {
      setError(tRef.current("loadError"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && canReadFinance) {
      fetchTaxCodes();
    }
  }, [authLoading, canReadFinance, fetchTaxCodes]);

  // --- Dialog handlers ---

  const openCreate = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEdit = (tc: TaxCode) => {
    setEditingId(tc.id);
    setForm({
      code: tc.code,
      label: tc.label,
      rate: tc.rate * 100,
      isDefault: tc.isDefault,
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

    const payload = {
      code: form.code,
      label: form.label,
      rate: form.rate / 100,
      isDefault: form.isDefault,
    };

    try {
      if (editingId) {
        const response = await apiRef.current.put(
          `/api/v1/finance/tax-codes/${editingId}`,
          payload
        );
        if (response.error) throw new Error(response.error);
        setSuccess(ttc("updateSuccess"));
      } else {
        const response = await apiRef.current.post(
          "/api/v1/finance/tax-codes",
          payload
        );
        if (response.error) throw new Error(response.error);
        setSuccess(ttc("createSuccess"));
      }
      closeDialog();
      await fetchTaxCodes();
    } catch {
      setError(t("saveError"));
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
      const response = await apiRef.current.delete(
        `/api/v1/finance/tax-codes/${id}`
      );
      if (response.error) throw new Error(response.error);
      setSuccess(ttc("deleteSuccess"));
      setConfirmDeleteId(null);
      await fetchTaxCodes();
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
        <div className="mx-auto max-w-4xl">
          <p className="text-gray-500">{tc("loading")}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Back to Settings */}
        <Link href="/finance/settings" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
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

        {/* Alerts */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        {/* Tax Codes Table */}
        {taxCodes.length === 0 ? (
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
                  {taxCodes.map((tc) => (
                    <tr
                      key={tc.id}
                      className="transition-colors hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 text-sm font-medium whitespace-nowrap text-gray-900">
                        {tc.code}
                      </td>
                      <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-700">
                        {tc.label}
                      </td>
                      <td className="px-6 py-4 text-right text-sm whitespace-nowrap text-gray-700">
                        {(tc.rate * 100).toFixed(2)}%
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        {tc.isDefault && (
                          <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">
                            {ttc("isDefault")}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            tc.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {tc.isActive ? t("active") : t("inactive")}
                        </span>
                      </td>
                      {canWriteFinance && (
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEdit(tc)}
                              className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                              title={ttc("editTaxCode")}
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(tc.id)}
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
      </div>

      {/* Create/Edit Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? ttc("editTaxCode") : ttc("addTaxCode")}
              </h2>
              <button
                onClick={closeDialog}
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
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                  placeholder={ttc("codePlaceholder")}
                  value={form.code}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, code: e.target.value }))
                  }
                />
              </div>

              {/* Label */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  {ttc("label")}
                  <span className="ml-1 text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                  placeholder={ttc("labelPlaceholder")}
                  value={form.label}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, label: e.target.value }))
                  }
                />
              </div>

              {/* Rate */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  {ttc("rate")}
                  <span className="ml-1 text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                  placeholder={ttc("ratePlaceholder")}
                  value={form.rate}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      rate: parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </div>

              {/* IsDefault */}
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  checked={form.isDefault}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      isDefault: e.target.checked,
                    }))
                  }
                />
                <span className="text-sm text-gray-700">
                  {ttc("isDefault")}
                </span>
              </label>
            </div>

            {/* Dialog Buttons */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeDialog}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.code || !form.label}
                className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? t("saving") : t("save")}
              </button>
            </div>
          </div>
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
    </main>
  );
}
