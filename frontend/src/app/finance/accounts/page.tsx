"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth, useApiClient } from "@/lib/auth";

interface Account {
  id: string;
  name: string;
  number: string;
  type: "Cash" | "Bank" | "Other";
  description: string;
  isActive: boolean;
  sortOrder: number;
}

interface AccountForm {
  name: string;
  number: string;
  type: "Cash" | "Bank" | "Other";
  description: string;
  isActive: boolean;
  sortOrder: number;
}

const emptyForm: AccountForm = {
  name: "",
  number: "",
  type: "Bank",
  description: "",
  isActive: true,
  sortOrder: 0,
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(
    amount
  );

export default function AccountsPage() {
  const t = useTranslations("finance");
  const router = useRouter();
  const { canReadFinance, canWriteFinance } = useAuth();
  const api = useApiClient();

  const apiRef = useRef(api);
  apiRef.current = api;
  const tRef = useRef(t);
  tRef.current = t;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [form, setForm] = useState<AccountForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiRef.current.get("/api/v1/finance/accounts");
      if (res.error) throw new Error(res.error);
      setAccounts(res.data as Account[]);
    } catch {
      setError(tRef.current("loadError"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canReadFinance) {
      router.replace("/");
      return;
    }
    fetchAccounts();
  }, [canReadFinance, router, fetchAccounts]);

  const openCreate = () => {
    setEditingAccount(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (account: Account) => {
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

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      setError(null);
      if (editingAccount) {
        await apiRef.current.put(
          `/api/v1/finance/accounts/${editingAccount.id}`,
          form
        );
      } else {
        await apiRef.current.post("/api/v1/finance/accounts", form);
      }
      closeModal();
      await fetchAccounts();
    } catch {
      setError(tRef.current("saveError"));
    } finally {
      setSaving(false);
    }
  }, [editingAccount, form, fetchAccounts]);

  const handleDelete = useCallback(async () => {
    if (!deleteConfirmId) return;
    try {
      setDeleting(true);
      setError(null);
      await apiRef.current.delete(
        `/api/v1/finance/accounts/${deleteConfirmId}`
      );
      setDeleteConfirmId(null);
      await fetchAccounts();
    } catch {
      setError(tRef.current("deleteError"));
    } finally {
      setDeleting(false);
    }
  }, [deleteConfirmId, fetchAccounts]);

  const typeBadge = (type: Account["type"]) => {
    const colors: Record<Account["type"], string> = {
      Cash: "bg-green-100 text-green-800",
      Bank: "bg-blue-100 text-blue-800",
      Other: "bg-gray-100 text-gray-800",
    };
    const labels: Record<Account["type"], string> = {
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

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Back to Settings */}
        <Link href="/finance/settings" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
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
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
          </div>
        )}

        {/* Empty State */}
        {!loading && accounts.length === 0 && (
          <div className="rounded-xl bg-white p-6 text-center text-gray-500 shadow-sm">
            {t("noAccounts")}
          </div>
        )}

        {/* Table */}
        {!loading && accounts.length > 0 && (
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
                {accounts.map((account) => (
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
                        type: e.target.value as Account["type"],
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
