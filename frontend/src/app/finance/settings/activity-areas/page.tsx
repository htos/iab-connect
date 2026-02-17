"use client";

/**
 * Activity Areas Management Page
 * REQ-068: Activity Area / Project Dimension Tagging
 */

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth, useApiClient } from "@/lib/auth";

// --- Types ---

interface ActivityArea {
  id: string;
  name: string;
  code: string;
  description: string | null;
  color: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface ActivityAreaForm {
  name: string;
  code: string;
  description: string;
  color: string;
  sortOrder: number;
}

const DEFAULT_FORM: ActivityAreaForm = {
  name: "",
  code: "",
  description: "",
  color: "",
  sortOrder: 0,
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

export default function ActivityAreasPage() {
  const t = useTranslations("activityAreas");
  const tc = useTranslations("common");
  const tf = useTranslations("finance");
  const { canReadFinance, canWriteFinance, isLoading: authLoading } = useAuth();
  const api = useApiClient();

  const apiRef = useRef(api);
  apiRef.current = api;

  const [areas, setAreas] = useState<ActivityArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ActivityAreaForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // --- Data fetching ---

  const fetchAreas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiRef.current.get<ActivityArea[]>(
        "/api/v1/finance/activity-areas"
      );
      if (response.error) {
        setError(response.error);
      } else if (response.data) {
        setAreas(response.data as ActivityArea[]);
      }
    } catch {
      setError("Failed to load activity areas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && canReadFinance) {
      fetchAreas();
    }
  }, [authLoading, canReadFinance, fetchAreas]);

  // --- Dialog handlers ---

  const openCreate = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEdit = (area: ActivityArea) => {
    setEditingId(area.id);
    setForm({
      name: area.name,
      code: area.code,
      description: area.description ?? "",
      color: area.color ?? "",
      sortOrder: area.sortOrder,
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
      name: form.name,
      code: form.code,
      description: form.description || null,
      color: form.color || null,
      sortOrder: form.sortOrder,
      ...(editingId ? { isActive: true } : {}),
    };

    try {
      if (editingId) {
        const response = await apiRef.current.put(
          `/api/v1/finance/activity-areas/${editingId}`,
          payload
        );
        if (response.error) throw new Error(response.error);
        setSuccess(t("updateSuccess"));
      } else {
        const response = await apiRef.current.post(
          "/api/v1/finance/activity-areas",
          payload
        );
        if (response.error) throw new Error(response.error);
        setSuccess(t("createSuccess"));
      }
      closeDialog();
      await fetchAreas();
    } catch {
      setError("Failed to save activity area");
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
        `/api/v1/finance/activity-areas/${id}`
      );
      if (response.error) throw new Error(response.error);
      setSuccess(t("deleteSuccess"));
      setConfirmDeleteId(null);
      await fetchAreas();
    } catch {
      setError("Failed to delete activity area");
    } finally {
      setDeleting(false);
    }
  };

  // --- Render ---

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

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Back link */}
        <Link
          href="/finance/settings"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {tf("backToSettings")}
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
              {t("addActivityArea")}
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

        {/* Table */}
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          {areas.length === 0 ? (
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
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t("code")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t("name")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t("description")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t("color")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t("sortOrder")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t("isActive")}
                  </th>
                  {canWriteFinance && (
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      {tc("actions")}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {areas.map((area) => (
                  <tr key={area.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-mono font-medium text-gray-900">
                      {area.code}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {area.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {area.description ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {area.color ? (
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="inline-block h-4 w-4 rounded"
                            style={{ backgroundColor: area.color }}
                          />
                          {area.color}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {area.sortOrder}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      <span
                        className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                          area.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {area.isActive ? tc("yes") : tc("no")}
                      </span>
                    </td>
                    {canWriteFinance && (
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
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

        {/* Create/Edit Dialog */}
        {dialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingId ? t("editActivityArea") : t("addActivityArea")}
                </h2>
                <button
                  onClick={closeDialog}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("name")} *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    placeholder={t("namePlaceholder")}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("code")} *
                  </label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) =>
                      setForm({ ...form, code: e.target.value })
                    }
                    placeholder={t("codePlaceholder")}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono uppercase focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("description")}
                  </label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    placeholder={t("descriptionPlaceholder")}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t("color")}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.color || "#ea580c"}
                        onChange={(e) =>
                          setForm({ ...form, color: e.target.value })
                        }
                        className="h-9 w-12 cursor-pointer rounded border border-gray-300"
                      />
                      <input
                        type="text"
                        value={form.color}
                        onChange={(e) =>
                          setForm({ ...form, color: e.target.value })
                        }
                        placeholder={t("colorPlaceholder")}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t("sortOrder")}
                    </label>
                    <input
                      type="number"
                      value={form.sortOrder}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          sortOrder: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
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
                  disabled={saving || !form.name || !form.code}
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
