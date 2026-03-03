"use client";

/**
 * Invoice Templates Management Page
 * REQ-064: EU Invoice Compliance — configurable invoice templates
 */

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth, useApiClient } from "@/lib/auth";

// --- Types ---

interface InvoiceTemplate {
  id: string;
  name: string;
  jurisdiction: string;
  countryCode: string | null;
  isDefault: boolean;
  showVatId: boolean;
  showTaxExemptionNote: boolean;
  taxExemptionNote: string | null;
  showReverseChargeNote: boolean;
  reverseChargeNote: string | null;
  showPaymentTerms: boolean;
  defaultPaymentTerms: string | null;
  showBankDetails: boolean;
  logoUrl: string | null;
  headerText: string | null;
  footerText: string | null;
  legalNotice: string | null;
  language: string;
}

interface InvoiceTemplateForm {
  name: string;
  jurisdiction: string;
  countryCode: string;
  isDefault: boolean;
  showVatId: boolean;
  showTaxExemptionNote: boolean;
  taxExemptionNote: string;
  showReverseChargeNote: boolean;
  reverseChargeNote: string;
  showPaymentTerms: boolean;
  defaultPaymentTerms: string;
  showBankDetails: boolean;
  logoUrl: string;
  headerText: string;
  footerText: string;
  legalNotice: string;
  language: string;
}

const DEFAULT_FORM: InvoiceTemplateForm = {
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

// --- Component ---

export default function InvoiceTemplatesPage() {
  const t = useTranslations("finance");
  const tit = useTranslations("finance.invoiceTemplates");
  const tc = useTranslations("common");
  const { canReadFinance, canWriteFinance, isLoading: authLoading } = useAuth();
  const api = useApiClient();

  const apiRef = useRef(api);
  apiRef.current = api;

  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<InvoiceTemplateForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // --- Data fetching ---

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiRef.current.get<InvoiceTemplate[]>(
        "/api/v1/finance/invoice-templates"
      );
      if (response.error) {
        setError(response.error);
      } else if (response.data) {
        const body = response.data as unknown as { items: InvoiceTemplate[] };
        setTemplates(body.items ?? []);
      }
    } catch {
      setError(tit("error"));
    } finally {
      setLoading(false);
    }
  }, [tit]);

  useEffect(() => {
    if (!authLoading && canReadFinance) {
      fetchTemplates();
    }
  }, [authLoading, canReadFinance, fetchTemplates]);

  // --- Dialog handlers ---

  const openCreate = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEdit = (tmpl: InvoiceTemplate) => {
    setEditingId(tmpl.id);
    setForm({
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
    setForm(DEFAULT_FORM);
  };

  const handleSave = async () => {
    if (!canWriteFinance) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = {
      name: form.name,
      jurisdiction: form.jurisdiction,
      countryCode: form.countryCode || null,
      isDefault: form.isDefault,
      showVatId: form.showVatId,
      showTaxExemptionNote: form.showTaxExemptionNote,
      taxExemptionNote: form.taxExemptionNote || null,
      showReverseChargeNote: form.showReverseChargeNote,
      reverseChargeNote: form.reverseChargeNote || null,
      showPaymentTerms: form.showPaymentTerms,
      defaultPaymentTerms: form.defaultPaymentTerms || null,
      showBankDetails: form.showBankDetails,
      logoUrl: form.logoUrl || null,
      headerText: form.headerText || null,
      footerText: form.footerText || null,
      legalNotice: form.legalNotice || null,
      language: form.language,
    };

    try {
      if (editingId) {
        const response = await apiRef.current.put(
          `/api/v1/finance/invoice-templates/${editingId}`,
          payload
        );
        if (response.error) throw new Error(response.error);
        setSuccess(tit("success"));
      } else {
        const response = await apiRef.current.post(
          "/api/v1/finance/invoice-templates",
          payload
        );
        if (response.error) throw new Error(response.error);
        setSuccess(tit("success"));
      }
      closeDialog();
      await fetchTemplates();
    } catch {
      setError(tit("error"));
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
        `/api/v1/finance/invoice-templates/${id}`
      );
      if (response.error) throw new Error(response.error);
      setSuccess(tit("deleteSuccess"));
      setConfirmDeleteId(null);
      await fetchTemplates();
    } catch {
      setError(tit("error"));
    } finally {
      setDeleting(false);
    }
  };

  // --- Form change helper ---

  const handleFormChange = (
    field: keyof InvoiceTemplateForm,
    value: string | boolean
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // --- Client-side filtering ---

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

  // --- Render ---

  if (authLoading || loading) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-gray-500">{tc("loading")}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
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
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder={tit("searchInvoiceTemplates")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
            />
          </div>
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
      </div>

      {/* Create/Edit Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? tit("editTitle") : tit("createTitle")}
              </h2>
              <button
                onClick={closeDialog}
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
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                  value={form.name}
                  onChange={(e) => handleFormChange("name", e.target.value)}
                />
              </div>

              {/* Jurisdiction & Country Code */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {!editingId && (
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">
                      {tit("jurisdiction")}
                      <span className="ml-1 text-red-500">*</span>
                    </label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                      value={form.jurisdiction}
                      onChange={(e) =>
                        handleFormChange("jurisdiction", e.target.value)
                      }
                    >
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
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                    value={form.countryCode}
                    onChange={(e) =>
                      handleFormChange("countryCode", e.target.value)
                    }
                    disabled={editingId !== null}
                  />
                </div>
              </div>

              {/* Language */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  {tit("language")}
                  <span className="ml-1 text-red-500">*</span>
                </label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                  value={form.language}
                  onChange={(e) =>
                    handleFormChange("language", e.target.value)
                  }
                >
                  <option value="en">English</option>
                  <option value="de">Deutsch</option>
                </select>
              </div>

              {/* Toggle: isDefault */}
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  checked={form.isDefault}
                  onChange={(e) =>
                    handleFormChange("isDefault", e.target.checked)
                  }
                />
                <span className="text-sm text-gray-700">
                  {tit("isDefault")}
                </span>
              </label>

              {/* Divider */}
              <hr className="border-gray-200" />

              {/* Toggle: showVatId */}
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  checked={form.showVatId}
                  onChange={(e) =>
                    handleFormChange("showVatId", e.target.checked)
                  }
                />
                <span className="text-sm text-gray-700">
                  {tit("showVatId")}
                </span>
              </label>

              {/* Toggle: showTaxExemptionNote + text */}
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  checked={form.showTaxExemptionNote}
                  onChange={(e) =>
                    handleFormChange("showTaxExemptionNote", e.target.checked)
                  }
                />
                <span className="text-sm text-gray-700">
                  {tit("showTaxExemptionNote")}
                </span>
              </label>
              {form.showTaxExemptionNote && (
                <div className="ml-6 space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    {tit("taxExemptionNote")}
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                    placeholder={tit("taxExemptionPlaceholder")}
                    value={form.taxExemptionNote}
                    onChange={(e) =>
                      handleFormChange("taxExemptionNote", e.target.value)
                    }
                  />
                </div>
              )}

              {/* Toggle: showReverseChargeNote + text */}
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  checked={form.showReverseChargeNote}
                  onChange={(e) =>
                    handleFormChange("showReverseChargeNote", e.target.checked)
                  }
                />
                <span className="text-sm text-gray-700">
                  {tit("showReverseChargeNote")}
                </span>
              </label>
              {form.showReverseChargeNote && (
                <div className="ml-6 space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    {tit("reverseChargeNote")}
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                    placeholder={tit("reverseChargePlaceholder")}
                    value={form.reverseChargeNote}
                    onChange={(e) =>
                      handleFormChange("reverseChargeNote", e.target.value)
                    }
                  />
                </div>
              )}

              {/* Toggle: showPaymentTerms + text */}
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  checked={form.showPaymentTerms}
                  onChange={(e) =>
                    handleFormChange("showPaymentTerms", e.target.checked)
                  }
                />
                <span className="text-sm text-gray-700">
                  {tit("showPaymentTerms")}
                </span>
              </label>
              {form.showPaymentTerms && (
                <div className="ml-6 space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    {tit("defaultPaymentTerms")}
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                    placeholder={tit("paymentTermsPlaceholder")}
                    value={form.defaultPaymentTerms}
                    onChange={(e) =>
                      handleFormChange("defaultPaymentTerms", e.target.value)
                    }
                  />
                </div>
              )}

              {/* Toggle: showBankDetails */}
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  checked={form.showBankDetails}
                  onChange={(e) =>
                    handleFormChange("showBankDetails", e.target.checked)
                  }
                />
                <span className="text-sm text-gray-700">
                  {tit("showBankDetails")}
                </span>
              </label>

              {/* Divider */}
              <hr className="border-gray-200" />

              {/* Logo URL */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  {tit("logoUrl")}
                </label>
                <input
                  type="url"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                  value={form.logoUrl}
                  onChange={(e) =>
                    handleFormChange("logoUrl", e.target.value)
                  }
                />
              </div>

              {/* Header Text */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  {tit("headerText")}
                </label>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                  value={form.headerText}
                  onChange={(e) =>
                    handleFormChange("headerText", e.target.value)
                  }
                />
              </div>

              {/* Footer Text */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  {tit("footerText")}
                </label>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                  value={form.footerText}
                  onChange={(e) =>
                    handleFormChange("footerText", e.target.value)
                  }
                />
              </div>

              {/* Legal Notice */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  {tit("legalNotice")}
                </label>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                  placeholder={tit("legalNoticePlaceholder")}
                  value={form.legalNotice}
                  onChange={(e) =>
                    handleFormChange("legalNotice", e.target.value)
                  }
                />
              </div>
            </div>

            {/* Dialog Buttons */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeDialog}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                {tc("cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.language}
                className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? tc("saving") : tc("save")}
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
              {tit("delete")}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {tit("deleteConfirm")}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                {tc("cancel")}
              </button>
              <button
                onClick={() =>
                  confirmDeleteId && handleDelete(confirmDeleteId)
                }
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? tc("loading") : tit("delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
