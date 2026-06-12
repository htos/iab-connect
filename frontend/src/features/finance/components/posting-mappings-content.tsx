"use client";

/**
 * Posting Mappings content (E26-S2 migration of `app/finance/posting-mappings/page.tsx`).
 * Composition root (only `"use client"`) — self-embeds its own `QueryClientProvider`.
 *
 * Lean read guard + DoubleEntry mode guard (redirect `/finance/settings`; list + lookups
 * gated on `modeChecked && canReadFinance`, A97). A56 SILENT-SWALLOW on BOTH save +
 * delete. On EDIT the mappingType + source selects are hidden; PUT carries ONLY
 * `{ ledgerAccountId, taxLedgerAccountId }`. target/tax-target <select>s filtered to
 * isActive (A95). delete=red modal confirm.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useDoubleEntryGuard } from "../hooks/use-double-entry-guard";
import { useLedgerAccounts } from "../hooks/use-ledger-accounts";
import { useAccounts } from "../hooks/use-accounts";
import { useCategories, useTaxCodes } from "../hooks/use-finance-lookups";
import {
  useDeletePostingMapping,
  usePostingMappings,
  useSavePostingMapping,
} from "../hooks/use-posting-mappings";
import type {
  PostingMapping,
  PostingMappingType,
} from "../types/finance.types";

interface MappingForm {
  mappingType: PostingMappingType;
  sourceId: string;
  ledgerAccountId: string;
  taxLedgerAccountId: string | null;
}

const emptyForm: MappingForm = {
  mappingType: "Category",
  sourceId: "",
  ledgerAccountId: "",
  taxLedgerAccountId: null,
};

function PostingMappingsBody() {
  const t = useTranslations("finance");
  const ta = useTranslations("finance.accounting");
  const router = useRouter();
  const { canReadFinance, canWriteFinance } = useAuth();

  const modeChecked = useDoubleEntryGuard(router.replace);
  const enabled = modeChecked && canReadFinance;

  const mappingsQuery = usePostingMappings(enabled);
  const mappings = mappingsQuery.data ?? [];
  const loading = enabled && mappingsQuery.isLoading;

  // The four parallel lookups (god-page `fetchLookups`).
  const ledgerAccounts = useLedgerAccounts(enabled).data ?? [];
  const categories = useCategories(enabled).data ?? [];
  const accounts = useAccounts(enabled).data ?? [];
  const taxCodes = useTaxCodes(enabled).data ?? [];

  const saveMapping = useSavePostingMapping();
  const deleteMapping = useDeletePostingMapping();

  const [error] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<PostingMapping | null>(
    null
  );
  const [form, setForm] = useState<MappingForm>(emptyForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const banner = error ?? (mappingsQuery.isError ? t("loadError") : null);

  useEffect(() => {
    if (!canReadFinance) {
      router.replace("/");
    }
  }, [canReadFinance, router]);

  const openCreate = () => {
    setEditingMapping(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (mapping: PostingMapping) => {
    setEditingMapping(mapping);
    setForm({
      mappingType: mapping.mappingType,
      sourceId: mapping.sourceId,
      ledgerAccountId: mapping.ledgerAccountId,
      taxLedgerAccountId: mapping.taxLedgerAccountId,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingMapping(null);
    setForm(emptyForm);
  };

  const handleSave = () => {
    // A56 silent-swallow: close + refetch regardless of res.error.
    if (editingMapping) {
      saveMapping.mutate(
        {
          id: editingMapping.id,
          editBody: {
            ledgerAccountId: form.ledgerAccountId,
            taxLedgerAccountId: form.taxLedgerAccountId || null,
          },
        },
        { onSuccess: () => closeModal() }
      );
    } else {
      saveMapping.mutate(
        {
          id: null,
          createBody: {
            mappingType: form.mappingType,
            sourceId: form.sourceId,
            ledgerAccountId: form.ledgerAccountId,
            taxLedgerAccountId: form.taxLedgerAccountId || null,
          },
        },
        { onSuccess: () => closeModal() }
      );
    }
  };

  const handleDelete = () => {
    if (!deleteConfirmId) return;
    deleteMapping.mutate(deleteConfirmId, {
      onSuccess: () => setDeleteConfirmId(null),
    });
  };

  const getSourceLabel = (mapping: PostingMapping) => {
    if (mapping.mappingType === "Category") {
      const cat = categories.find((c) => c.id === mapping.sourceId);
      return cat ? cat.name : mapping.sourceId;
    }
    if (mapping.mappingType === "Account") {
      const acc = accounts.find((a) => a.id === mapping.sourceId);
      return acc ? `${acc.number} – ${acc.name}` : mapping.sourceId;
    }
    if (mapping.mappingType === "TaxCode") {
      const tc = taxCodes.find((tc) => tc.id === mapping.sourceId);
      return tc ? `${tc.code} (${tc.rate}%)` : mapping.sourceId;
    }
    return mapping.sourceId;
  };

  const sourceOptions = () => {
    if (form.mappingType === "Category")
      return categories.map((c) => ({ value: c.id, label: c.name }));
    if (form.mappingType === "Account")
      return accounts.map((a) => ({
        value: a.id,
        label: `${a.number} – ${a.name}`,
      }));
    if (form.mappingType === "TaxCode")
      return taxCodes.map((tc) => ({
        value: tc.id,
        label: `${tc.code} (${tc.rate}%)`,
      }));
    return [];
  };

  const typeBadge = (type: PostingMappingType) => {
    const colors: Record<PostingMappingType, string> = {
      Category: "bg-violet-100 text-violet-800",
      Account: "bg-blue-100 text-blue-800",
      TaxCode: "bg-amber-100 text-amber-800",
    };
    const labels: Record<PostingMappingType, string> = {
      Category: ta("mappingTypeCategory"),
      Account: ta("mappingTypeAccount"),
      TaxCode: ta("mappingTypeTaxCode"),
    };
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[type]}`}
      >
        {labels[type]}
      </span>
    );
  };

  const filteredMappings = mappings.filter((m) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const sourceLabel = getSourceLabel(m).toLowerCase();
    const targetAccount =
      `${m.ledgerAccountNumber} – ${m.ledgerAccountName}`.toLowerCase();
    const taxAccount = m.taxLedgerAccountNumber
      ? `${m.taxLedgerAccountNumber} – ${m.taxLedgerAccountName}`.toLowerCase()
      : "";
    const typeLabel = m.mappingType.toLowerCase();
    return (
      sourceLabel.includes(term) ||
      targetAccount.includes(term) ||
      taxAccount.includes(term) ||
      typeLabel.includes(term)
    );
  });

  const saving = saveMapping.isPending;
  const deleting = deleteMapping.isPending;

  if (!canReadFinance) return null;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Back */}
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {ta("postingMappings")}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {ta("postingMappingsSubtitle")}
            </p>
          </div>
          {canWriteFinance && (
            <button
              onClick={openCreate}
              className="rounded-lg bg-orange-600 px-4 py-2 font-medium text-white transition-colors hover:bg-orange-700"
            >
              {ta("newMapping")}
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
              placeholder={ta("searchPostingMappings")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-10 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* Error */}
        {banner && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {banner}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
          </div>
        )}

        {/* Empty */}
        {!loading && filteredMappings.length === 0 && (
          <div className="rounded-xl bg-white p-6 text-center text-gray-500 shadow-sm">
            {ta("noMappings")}
          </div>
        )}

        {/* Table */}
        {!loading && filteredMappings.length > 0 && (
          <div className="overflow-x-auto rounded-xl bg-white p-6 shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 text-sm text-gray-500">
                  <th className="pb-3 font-medium">{ta("mappingType")}</th>
                  <th className="pb-3 font-medium">{ta("sourceItem")}</th>
                  <th className="pb-3 font-medium">{ta("targetAccount")}</th>
                  <th className="pb-3 font-medium">{ta("taxTargetAccount")}</th>
                  {canWriteFinance && (
                    <th className="pb-3 text-right font-medium">
                      {t("actions")}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMappings.map((m) => (
                  <tr key={m.id} className="text-sm">
                    <td className="py-3">{typeBadge(m.mappingType)}</td>
                    <td className="py-3 text-gray-900">{getSourceLabel(m)}</td>
                    <td className="py-3 text-gray-900">
                      {m.ledgerAccountNumber} – {m.ledgerAccountName}
                    </td>
                    <td className="py-3 text-gray-600">
                      {m.taxLedgerAccountNumber
                        ? `${m.taxLedgerAccountNumber} – ${m.taxLedgerAccountName}`
                        : "–"}
                    </td>
                    {canWriteFinance && (
                      <td className="space-x-2 py-3 text-right">
                        <button
                          onClick={() => openEdit(m)}
                          className="text-sm font-medium text-orange-600 hover:text-orange-700"
                        >
                          {t("edit")}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(m.id)}
                          className="text-sm font-medium text-red-600 hover:text-red-700"
                        >
                          {t("delete")}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create/Edit Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-lg">
              <h2 className="text-lg font-bold text-gray-900">
                {editingMapping ? ta("editMapping") : ta("newMapping")}
              </h2>
              <div className="space-y-3">
                {/* Mapping Type (only for create) */}
                {!editingMapping && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {ta("mappingType")} *
                    </label>
                    <select
                      value={form.mappingType}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          mappingType: e.target.value as PostingMappingType,
                          sourceId: "",
                        })
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    >
                      <option value="Category">
                        {ta("mappingTypeCategory")}
                      </option>
                      <option value="Account">
                        {ta("mappingTypeAccount")}
                      </option>
                      <option value="TaxCode">
                        {ta("mappingTypeTaxCode")}
                      </option>
                    </select>
                  </div>
                )}
                {/* Source */}
                {!editingMapping && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {ta("sourceItem")} *
                    </label>
                    <select
                      value={form.sourceId}
                      onChange={(e) =>
                        setForm({ ...form, sourceId: e.target.value })
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    >
                      <option value="">{ta("selectSource")}</option>
                      {sourceOptions().map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {/* Target Ledger Account */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {ta("targetAccount")} *
                  </label>
                  <select
                    value={form.ledgerAccountId}
                    onChange={(e) =>
                      setForm({ ...form, ledgerAccountId: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  >
                    <option value="">{ta("selectLedgerAccount")}</option>
                    {ledgerAccounts
                      .filter((a) => a.isActive)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.number} – {a.name}
                        </option>
                      ))}
                  </select>
                </div>
                {/* Tax Target Account */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {ta("taxTargetAccount")}
                  </label>
                  <select
                    value={form.taxLedgerAccountId ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        taxLedgerAccountId: e.target.value || null,
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  >
                    <option value="">–</option>
                    {ledgerAccounts
                      .filter((a) => a.isActive)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.number} – {a.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={closeModal}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={handleSave}
                  disabled={
                    saving ||
                    !form.ledgerAccountId ||
                    (!editingMapping && !form.sourceId)
                  }
                  className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
                >
                  {saving ? "..." : t("save")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-lg">
              <h2 className="text-lg font-bold text-gray-900">{t("delete")}</h2>
              <p className="text-sm text-gray-600">{t("confirmDelete")}</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "..." : t("delete")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export function PostingMappingsContent() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <PostingMappingsBody />
    </QueryClientProvider>
  );
}
