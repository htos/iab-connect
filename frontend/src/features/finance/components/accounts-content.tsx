"use client";

/**
 * Operating Accounts content (E26-S2 migration of `app/finance/accounts/page.tsx`).
 * Composition root (only `"use client"`) — self-embeds its own `QueryClientProvider`.
 *
 * Lean read guard (canReadFinance-only; `router.replace("/")`; `return null`). A56
 * SILENT-SWALLOW preserved on BOTH save + delete (the modal closes + the list refetches
 * even on a `res.error`, no error banner) — pinned by the E26-S1 net. delete=red modal
 * confirm. Every i18n key + URL byte-identical.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  useAccounts,
  useDeleteAccount,
  useSaveAccount,
} from "../hooks/use-accounts";
import type {
  OperatingAccount,
  OperatingAccountForm,
} from "../types/finance.types";

const emptyForm: OperatingAccountForm = {
  name: "",
  number: "",
  type: "Bank",
  description: "",
  isActive: true,
  sortOrder: 0,
};

function AccountsBody() {
  const t = useTranslations("finance");
  const router = useRouter();
  const { canReadFinance, canWriteFinance } = useAuth();

  const accountsQuery = useAccounts(canReadFinance);
  const accounts = accountsQuery.data ?? [];
  const loading = canReadFinance && accountsQuery.isLoading;
  const saveAccount = useSaveAccount();
  const deleteAccount = useDeleteAccount();

  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<OperatingAccount | null>(
    null
  );
  const [form, setForm] = useState<OperatingAccountForm>(emptyForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const loadError = accountsQuery.isError ? t("loadError") : null;
  const banner = error ?? loadError;

  useEffect(() => {
    if (!canReadFinance) {
      router.replace("/");
    }
  }, [canReadFinance, router]);

  const openCreate = () => {
    setEditingAccount(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (account: OperatingAccount) => {
    setEditingAccount(account);
    setForm({
      name: account.name,
      number: account.number,
      type: account.type,
      description: account.description,
      isActive: account.isActive,
      sortOrder: account.sortOrder,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingAccount(null);
    setForm(emptyForm);
  };

  const handleSave = () => {
    setError(null);
    saveAccount.mutate(
      { id: editingAccount?.id ?? null, form },
      {
        // A56 silent-swallow: close + refetch regardless of res.error (the mutationFn
        // never throws on res.error). onError only fires for a real rejected promise.
        onSuccess: () => closeModal(),
      }
    );
  };

  const handleDelete = () => {
    if (!deleteConfirmId) return;
    setError(null);
    deleteAccount.mutate(deleteConfirmId, {
      onSuccess: () => setDeleteConfirmId(null),
    });
  };

  const filteredAccounts = accounts.filter((account) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      account.name.toLowerCase().includes(term) ||
      account.number.toLowerCase().includes(term) ||
      account.type.toLowerCase().includes(term) ||
      account.description.toLowerCase().includes(term)
    );
  });

  const typeBadge = (type: OperatingAccount["type"]) => {
    const colors: Record<OperatingAccount["type"], string> = {
      Cash: "bg-green-100 text-green-800",
      Bank: "bg-blue-100 text-blue-800",
      Other: "bg-gray-100 text-gray-800",
    };
    const labels: Record<OperatingAccount["type"], string> = {
      Cash: t("cash"),
      Bank: t("bank"),
      Other: t("other"),
    };
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[type]}`}
      >
        {labels[type]}
      </span>
    );
  };

  if (!canReadFinance) return null;

  const saving = saveAccount.isPending;
  const deleting = deleteAccount.isPending;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{t("accounts")}</h1>
          {canWriteFinance && (
            <button
              onClick={openCreate}
              className="rounded-lg bg-orange-600 px-4 py-2 font-medium text-white transition-colors hover:bg-orange-700"
            >
              {t("newAccount")}
            </button>
          )}
        </div>

        {/* Error Banner */}
        {banner && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {banner}
          </div>
        )}

        {/* Search */}
        {!loading && accounts.length > 0 && (
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
                placeholder={t("searchAccounts")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-10 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredAccounts.length === 0 && (
          <div className="rounded-xl bg-white p-6 text-center text-gray-500 shadow-sm">
            {t("noAccounts")}
          </div>
        )}

        {/* Table */}
        {!loading && filteredAccounts.length > 0 && (
          <div className="overflow-x-auto rounded-xl bg-white p-6 shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 text-sm text-gray-500">
                  <th className="pb-3 font-medium">{t("accountName")}</th>
                  <th className="pb-3 font-medium">{t("accountNumber")}</th>
                  <th className="pb-3 font-medium">{t("accountType")}</th>
                  <th className="pb-3 font-medium">{t("active")}</th>
                  <th className="pb-3 font-medium">{t("sortOrder")}</th>
                  {canWriteFinance && (
                    <th className="pb-3 text-right font-medium">
                      {t("actions")}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAccounts.map((account) => (
                  <tr key={account.id} className="text-sm">
                    <td className="py-3 font-medium text-gray-900">
                      {account.name}
                    </td>
                    <td className="py-3 text-gray-600">{account.number}</td>
                    <td className="py-3">{typeBadge(account.type)}</td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          account.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {account.isActive ? t("active") : t("inactive")}
                      </span>
                    </td>
                    <td className="py-3 text-gray-600">{account.sortOrder}</td>
                    {canWriteFinance && (
                      <td className="space-x-2 py-3 text-right">
                        <button
                          onClick={() => openEdit(account)}
                          className="text-sm font-medium text-orange-600 hover:text-orange-700"
                        >
                          {t("editAccount")}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(account.id)}
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
                {editingAccount ? t("editAccount") : t("newAccount")}
              </h2>

              <div className="space-y-3">
                {/* Name */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("accountName")} *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>

                {/* Number */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("accountNumber")} *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.number}
                    onChange={(e) =>
                      setForm({ ...form, number: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("accountType")}
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        type: e.target.value as OperatingAccount["type"],
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  >
                    <option value="Cash">{t("cash")}</option>
                    <option value="Bank">{t("bank")}</option>
                    <option value="Other">{t("other")}</option>
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("description")}
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>

                {/* IsActive */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={form.isActive}
                    onChange={(e) =>
                      setForm({ ...form, isActive: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  <label
                    htmlFor="isActive"
                    className="text-sm font-medium text-gray-700"
                  >
                    {t("active")}
                  </label>
                </div>

                {/* Sort Order */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("sortOrder")}
                  </label>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) =>
                      setForm({ ...form, sortOrder: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
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
                  disabled={saving || !form.name || !form.number}
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

export function AccountsContent() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <AccountsBody />
    </QueryClientProvider>
  );
}
