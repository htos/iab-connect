"use client";

/**
 * SETTINGS Activity Areas content (E26-S6 migration of
 * `app/finance/settings/activity-areas/page.tsx`). Composition root (only `"use client"`) —
 * self-embeds its own `QueryClientProvider`.
 *
 * Behaviour preserved AS-IS (A56, the E26-S1 settings/activity-areas net is the oracle):
 *   - Guard: `if (authLoading || loading) return <skeleton>` then `if (!canReadFinance) return null`.
 *     `loading` starts true and only clears via the guarded fetch, so a non-read user is stuck on
 *     the skeleton (never reaches `return null`). Preserved AS-IS.
 *   - `{ items }` GET envelope. INLINE-confirm delete (two-step in-row, NOT a modal).
 *   - HARDCODED-ENGLISH error strings preserved VERBATIM (A56 — do NOT translate): a res.error GET
 *     surfaces verbatim ("boom"); a rejected GET → "Failed to load activity areas"; save →
 *     "Failed to save activity area"; delete → "Failed to delete activity area".
 *   - DEC-3: REUSES the foundation's `ActivityArea` type + activity-areas CRUD builders. The form
 *     OMITS `isActive` (edit hard-codes `isActive: true` at the hook boundary).
 *   - A92: the modal closes from the mutation OUTCOME (`onSuccess`); a failed save keeps it open.
 */

import { useState } from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  useDeleteSettingsActivityArea,
  useSaveSettingsActivityArea,
  useSettingsActivityAreas,
} from "../../hooks/use-settings-activity-areas";
import {
  settingsActivityAreaFormSchema,
  type SettingsActivityAreaFormValues,
} from "../../schemas/settings-activity-area.schema";
import type { ActivityArea } from "../../types/settings.types";

const DEFAULT_VALUES: SettingsActivityAreaFormValues = {
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

interface ActivityAreaFormProps {
  defaultValues: SettingsActivityAreaFormValues;
  editing: boolean;
  saving: boolean;
  onSubmit: (values: SettingsActivityAreaFormValues) => void;
  onClose: () => void;
}

/** The shared create/edit settings activity-area form (RHF + Zod). Omits `isActive` (DEC-3). */
function ActivityAreaForm({
  defaultValues,
  editing,
  saving,
  onSubmit,
  onClose,
}: ActivityAreaFormProps) {
  const t = useTranslations("activityAreas");
  const tc = useTranslations("common");
  const { register, handleSubmit, control, setValue } =
    useForm<SettingsActivityAreaFormValues>({
      resolver: zodResolver(settingsActivityAreaFormSchema),
      defaultValues,
    });
  // The god-page disabled-gate: !form.name || !form.code.
  const name = useWatch({ control, name: "name" });
  const code = useWatch({ control, name: "code" });
  const color = useWatch({ control, name: "color" });

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {editing ? t("editActivityArea") : t("addActivityArea")}
        </h2>
        <button
          type="button"
          onClick={onClose}
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
            placeholder={t("namePlaceholder")}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
            {...register("name")}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("code")} *
          </label>
          <input
            type="text"
            placeholder={t("codePlaceholder")}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm uppercase focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
            {...register("code")}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("description")}
          </label>
          <input
            type="text"
            placeholder={t("descriptionPlaceholder")}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
            {...register("description")}
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
                value={color || "#ea580c"}
                onChange={(e) =>
                  // Mirror the god-page: the color picker + text field both write form.color.
                  setValue("color", e.target.value, { shouldValidate: false })
                }
                className="h-9 w-12 cursor-pointer rounded border border-gray-300"
              />
              <input
                type="text"
                placeholder={t("colorPlaceholder")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                {...register("color")}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("sortOrder")}
            </label>
            <input
              type="number"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
              {...register("sortOrder", { valueAsNumber: true })}
            />
          </div>
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
          disabled={saving || !name || !code}
          className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
        >
          {saving ? tc("saving") : tc("save")}
        </button>
      </div>
    </form>
  );
}

function ActivityAreasBody() {
  const t = useTranslations("activityAreas");
  const tc = useTranslations("common");
  const tf = useTranslations("finance");
  const { canReadFinance, canWriteFinance, isLoading: authLoading } = useAuth();

  const areasQuery = useSettingsActivityAreas(!authLoading && canReadFinance);
  const areas = areasQuery.data ?? [];
  // A56: `loading` starts true and only clears via the guarded fetch — a non-read user stays here.
  const loading = authLoading || !canReadFinance || areasQuery.isPending;

  const saveArea = useSaveSettingsActivityArea();
  const deleteArea = useDeleteSettingsActivityArea();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formDefaults, setFormDefaults] =
    useState<SettingsActivityAreaFormValues>(DEFAULT_VALUES);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // A56: hardcoded-English load error — the query's error.message is the verbatim string
  // (res.error → "boom"; rejected → "Failed to load activity areas").
  const loadError = areasQuery.isError
    ? (areasQuery.error as Error).message
    : null;
  const banner = error ?? loadError;

  const filteredAreas = areas.filter((area) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      area.name.toLowerCase().includes(term) ||
      area.code.toLowerCase().includes(term) ||
      (area.description ?? "").toLowerCase().includes(term)
    );
  });

  const openCreate = () => {
    setEditingId(null);
    setFormDefaults(DEFAULT_VALUES);
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
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setFormDefaults(DEFAULT_VALUES);
  };

  const handleSubmit = (values: SettingsActivityAreaFormValues) => {
    if (!canWriteFinance) return;
    setError(null);
    setSuccess(null);
    saveArea.mutate(
      { id: editingId, values },
      {
        onSuccess: () => {
          setSuccess(editingId ? t("updateSuccess") : t("createSuccess"));
          closeDialog();
        },
        // A56: hardcoded-English save error.
        onError: (err) => setError(err.message),
      }
    );
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
      // A56: hardcoded-English delete error.
      onError: (err) => setError(err.message),
    });
  };

  if (loading) {
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

  const saving = saveArea.isPending;
  const deleting = deleteArea.isPending;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Back link */}
        <Link
          href="/finance/settings"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
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
              placeholder={t("searchSettingsActivityAreas")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-10 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* Table */}
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
                  <tr key={area.id} className="hover:bg-gray-50">
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
                          {area.color}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                      {area.sortOrder}
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap">
                      <span
                        className={`inline-flex rounded-full px-2 text-xs leading-5 font-semibold ${
                          area.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {area.isActive ? tc("yes") : tc("no")}
                      </span>
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

        {/* Create/Edit Dialog */}
        {dialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <ActivityAreaForm
              key={editingId ?? "new"}
              defaultValues={formDefaults}
              editing={editingId !== null}
              saving={saving}
              onSubmit={handleSubmit}
              onClose={closeDialog}
            />
          </div>
        )}
      </div>
    </main>
  );
}

export function SettingsActivityAreasContent() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <ActivityAreasBody />
    </QueryClientProvider>
  );
}
