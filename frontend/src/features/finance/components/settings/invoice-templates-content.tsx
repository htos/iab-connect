"use client";

/**
 * Invoice Templates content (E26-S6 migration of
 * `app/finance/settings/invoice-templates/page.tsx`). Composition root (only `"use client"`) —
 * self-embeds its own `QueryClientProvider`.
 *
 * Behaviour preserved AS-IS (A56, the E26-S1 invoice-templates net is the oracle):
 *   - Guard: `if (authLoading || loading) return <loading>`; NO `!canReadFinance` early-return —
 *     `loading` starts true and only clears via the guarded fetch, so a non-read user is stuck on
 *     tc("loading") and fires no GET (preserve AS-IS).
 *   - `{ items }` GET envelope. MODAL delete (red confirm). Write-gated create/edit/delete.
 *   - A98 mode-divergent surfaces threaded through the form props: the `jurisdiction` <select> is
 *     rendered ONLY in create mode (`!editing`); the `countryCode` <input> is `disabled` on edit
 *     (immutable). A95: language (en/de) + jurisdiction (CH/EU) are full unions.
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
  useDeleteInvoiceTemplate,
  useInvoiceTemplatesQuery,
  useSaveInvoiceTemplate,
} from "../../hooks/use-invoice-templates";
import {
  invoiceTemplateFormSchema,
  type InvoiceTemplateFormValues,
} from "../../schemas/invoice-template.schema";
import type { InvoiceTemplate } from "../../types/settings.types";

const DEFAULT_VALUES: InvoiceTemplateFormValues = {
  name: "",
  jurisdiction: "EU",
  countryCode: "",
  isDefault: false,
  showVatId: true,
  showTaxExemptionNote: false,
  taxExemptionNote: "",
  showReverseChargeNote: false,
  reverseChargeNote: "",
  showPaymentTerms: true,
  defaultPaymentTerms: "",
  showBankDetails: true,
  logoUrl: "",
  headerText: "",
  footerText: "",
  legalNotice: "",
  language: "en",
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

const TemplateIcon = ({ className }: { className?: string }) => (
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
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

interface InvoiceTemplateFormProps {
  defaultValues: InvoiceTemplateFormValues;
  editing: boolean;
  saving: boolean;
  onSubmit: (values: InvoiceTemplateFormValues) => void;
  onClose: () => void;
}

/** The shared create/edit invoice-template form (RHF + Zod). A98 mode props threaded in. */
function InvoiceTemplateForm({
  defaultValues,
  editing,
  saving,
  onSubmit,
  onClose,
}: InvoiceTemplateFormProps) {
  const tit = useTranslations("finance.invoiceTemplates");
  const tc = useTranslations("common");
  const { register, handleSubmit, control } =
    useForm<InvoiceTemplateFormValues>({
      resolver: zodResolver(invoiceTemplateFormSchema),
      defaultValues,
    });
  // The god-page disabled-gate: !form.name || !form.language.
  const name = useWatch({ control, name: "name" });
  const language = useWatch({ control, name: "language" });
  const showTaxExemptionNote = useWatch({
    control,
    name: "showTaxExemptionNote",
  });
  const showReverseChargeNote = useWatch({
    control,
    name: "showReverseChargeNote",
  });
  const showPaymentTerms = useWatch({ control, name: "showPaymentTerms" });

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {editing ? tit("editTitle") : tit("createTitle")}
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
        {/* Name */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            {tit("name")}
            <span className="ml-1 text-red-500">*</span>
          </label>
          <input type="text" className={inputClass} {...register("name")} />
        </div>

        {/* Jurisdiction (create-only) & Country Code (edit-locked) */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {!editing && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                {tit("jurisdiction")}
                <span className="ml-1 text-red-500">*</span>
              </label>
              <select className={inputClass} {...register("jurisdiction")}>
                <option value="CH">CH</option>
                <option value="EU">EU</option>
              </select>
            </div>
          )}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              {tit("countryCode")}
            </label>
            <input
              type="text"
              maxLength={2}
              className={inputClass}
              disabled={editing}
              {...register("countryCode")}
            />
          </div>
        </div>

        {/* Language */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            {tit("language")}
            <span className="ml-1 text-red-500">*</span>
          </label>
          <select className={inputClass} {...register("language")}>
            <option value="en">English</option>
            <option value="de">Deutsch</option>
          </select>
        </div>

        {/* Toggle: isDefault */}
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            {...register("isDefault")}
          />
          <span className="text-sm text-gray-700">{tit("isDefault")}</span>
        </label>

        <hr className="border-gray-200" />

        {/* Toggle: showVatId */}
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            {...register("showVatId")}
          />
          <span className="text-sm text-gray-700">{tit("showVatId")}</span>
        </label>

        {/* Toggle: showTaxExemptionNote + text */}
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            {...register("showTaxExemptionNote")}
          />
          <span className="text-sm text-gray-700">
            {tit("showTaxExemptionNote")}
          </span>
        </label>
        {showTaxExemptionNote && (
          <div className="ml-6 space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              {tit("taxExemptionNote")}
            </label>
            <input
              type="text"
              className={inputClass}
              placeholder={tit("taxExemptionPlaceholder")}
              {...register("taxExemptionNote")}
            />
          </div>
        )}

        {/* Toggle: showReverseChargeNote + text */}
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            {...register("showReverseChargeNote")}
          />
          <span className="text-sm text-gray-700">
            {tit("showReverseChargeNote")}
          </span>
        </label>
        {showReverseChargeNote && (
          <div className="ml-6 space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              {tit("reverseChargeNote")}
            </label>
            <input
              type="text"
              className={inputClass}
              placeholder={tit("reverseChargePlaceholder")}
              {...register("reverseChargeNote")}
            />
          </div>
        )}

        {/* Toggle: showPaymentTerms + text */}
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            {...register("showPaymentTerms")}
          />
          <span className="text-sm text-gray-700">
            {tit("showPaymentTerms")}
          </span>
        </label>
        {showPaymentTerms && (
          <div className="ml-6 space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              {tit("defaultPaymentTerms")}
            </label>
            <input
              type="text"
              className={inputClass}
              placeholder={tit("paymentTermsPlaceholder")}
              {...register("defaultPaymentTerms")}
            />
          </div>
        )}

        {/* Toggle: showBankDetails */}
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            {...register("showBankDetails")}
          />
          <span className="text-sm text-gray-700">
            {tit("showBankDetails")}
          </span>
        </label>

        <hr className="border-gray-200" />

        {/* Logo URL */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            {tit("logoUrl")}
          </label>
          <input type="url" className={inputClass} {...register("logoUrl")} />
        </div>

        {/* Header Text */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            {tit("headerText")}
          </label>
          <textarea
            rows={2}
            className={inputClass}
            {...register("headerText")}
          />
        </div>

        {/* Footer Text */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            {tit("footerText")}
          </label>
          <textarea
            rows={2}
            className={inputClass}
            {...register("footerText")}
          />
        </div>

        {/* Legal Notice */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            {tit("legalNotice")}
          </label>
          <textarea
            rows={2}
            className={inputClass}
            placeholder={tit("legalNoticePlaceholder")}
            {...register("legalNotice")}
          />
        </div>
      </div>

      {/* Dialog Buttons */}
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          {tc("cancel")}
        </button>
        <button
          type="submit"
          disabled={saving || !name || !language}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? tc("saving") : tc("save")}
        </button>
      </div>
    </form>
  );
}

function InvoiceTemplatesBody() {
  const t = useTranslations("finance");
  const tit = useTranslations("finance.invoiceTemplates");
  const tc = useTranslations("common");
  const { canReadFinance, canWriteFinance, isLoading: authLoading } = useAuth();

  const templatesQuery = useInvoiceTemplatesQuery(
    !authLoading && canReadFinance
  );
  const templates = templatesQuery.data ?? [];
  // A56: `loading` starts true and only clears via the guarded fetch — a non-read user stays here.
  const loading = authLoading || !canReadFinance || templatesQuery.isPending;

  const saveTemplate = useSaveInvoiceTemplate();
  const deleteTemplate = useDeleteInvoiceTemplate();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formDefaults, setFormDefaults] =
    useState<InvoiceTemplateFormValues>(DEFAULT_VALUES);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadError = templatesQuery.isError
    ? (templatesQuery.error as Error).message
    : null;
  const banner = error ?? loadError;

  const openCreate = () => {
    setEditingId(null);
    setFormDefaults(DEFAULT_VALUES);
    setDialogOpen(true);
  };

  const openEdit = (tmpl: InvoiceTemplate) => {
    setEditingId(tmpl.id);
    setFormDefaults({
      name: tmpl.name,
      jurisdiction: tmpl.jurisdiction,
      countryCode: tmpl.countryCode ?? "",
      isDefault: tmpl.isDefault,
      showVatId: tmpl.showVatId,
      showTaxExemptionNote: tmpl.showTaxExemptionNote,
      taxExemptionNote: tmpl.taxExemptionNote ?? "",
      showReverseChargeNote: tmpl.showReverseChargeNote,
      reverseChargeNote: tmpl.reverseChargeNote ?? "",
      showPaymentTerms: tmpl.showPaymentTerms,
      defaultPaymentTerms: tmpl.defaultPaymentTerms ?? "",
      showBankDetails: tmpl.showBankDetails,
      logoUrl: tmpl.logoUrl ?? "",
      headerText: tmpl.headerText ?? "",
      footerText: tmpl.footerText ?? "",
      legalNotice: tmpl.legalNotice ?? "",
      language: tmpl.language,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setFormDefaults(DEFAULT_VALUES);
  };

  const handleSubmit = (values: InvoiceTemplateFormValues) => {
    if (!canWriteFinance) return;
    setError(null);
    setSuccess(null);
    saveTemplate.mutate(
      { id: editingId, values },
      {
        onSuccess: () => {
          // The god-page sets tit("success") for BOTH create and edit.
          setSuccess(tit("success"));
          closeDialog();
        },
        onError: () => setError(tit("error")),
      }
    );
  };

  const handleDelete = (id: string) => {
    if (!canWriteFinance) return;
    setError(null);
    setSuccess(null);
    deleteTemplate.mutate(id, {
      onSuccess: () => {
        setSuccess(tit("deleteSuccess"));
        setConfirmDeleteId(null);
      },
      // A56: the modal stays open + the error key surfaces on failure.
      onError: () => setError(tit("error")),
    });
  };

  const filteredTemplates = templates.filter((tmpl) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      tmpl.name.toLowerCase().includes(term) ||
      tmpl.jurisdiction.toLowerCase().includes(term) ||
      (tmpl.countryCode?.toLowerCase().includes(term) ?? false) ||
      tmpl.language.toLowerCase().includes(term) ||
      (tmpl.headerText?.toLowerCase().includes(term) ?? false) ||
      (tmpl.footerText?.toLowerCase().includes(term) ?? false) ||
      (tmpl.legalNotice?.toLowerCase().includes(term) ?? false)
    );
  });

  if (loading) {
    return (
      <PageShell maxWidth="5xl">
        <p className="text-gray-500">{tc("loading")}</p>
      </PageShell>
    );
  }

  const saving = saveTemplate.isPending;
  const deleting = deleteTemplate.isPending;

  return (
    <PageShell maxWidth="5xl">
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
            {tit("title")}
          </h1>
          <p className="mt-1 text-gray-600">{tit("subtitle")}</p>
        </div>
        {canWriteFinance && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700"
          >
            <PlusIcon className="h-5 w-5" />
            {tit("create")}
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
            placeholder={tit("searchInvoiceTemplates")}
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

      {/* Templates Table */}
      {filteredTemplates.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100">
            <TemplateIcon className="h-6 w-6 text-orange-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">
            {tit("noTemplatesTitle")}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {tit("noTemplatesMessage")}
          </p>
          {canWriteFinance && (
            <button
              onClick={openCreate}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700"
            >
              <PlusIcon className="h-5 w-5" />
              {tit("create")}
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
                    {tit("name")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    {tit("jurisdiction")}
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium tracking-wider text-gray-500 uppercase">
                    {tit("isDefault")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    {tit("language")}
                  </th>
                  {canWriteFinance && (
                    <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                      {tit("actions")}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredTemplates.map((tmpl) => (
                  <tr
                    key={tmpl.id}
                    className="transition-colors hover:bg-gray-50"
                  >
                    <td className="px-6 py-4 text-sm font-medium whitespace-nowrap text-gray-900">
                      {tmpl.name}
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-700">
                      {tmpl.jurisdiction}
                      {tmpl.countryCode && (
                        <span className="ml-1 text-gray-400">
                          ({tmpl.countryCode})
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      {tmpl.isDefault && (
                        <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">
                          {tit("isDefault")}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-700">
                      {tmpl.language.toUpperCase()}
                    </td>
                    {canWriteFinance && (
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(tmpl)}
                            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                            title={tit("edit")}
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(tmpl.id)}
                            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
                            title={tit("delete")}
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
          <InvoiceTemplateForm
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
              {tit("delete")}
            </h2>
            <p className="mt-2 text-sm text-gray-600">{tit("deleteConfirm")}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                {tc("cancel")}
              </button>
              <button
                onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? tc("loading") : tit("delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

export function InvoiceTemplatesContent() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <InvoiceTemplatesBody />
    </QueryClientProvider>
  );
}
