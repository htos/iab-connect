"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth, useApiClient } from "@/lib/auth";
import type { LedgerAccount, LedgerAccountClass, NormalBalance } from "@/types/finance";

interface LedgerAccountForm {
  number: string;
  name: string;
  accountClass: LedgerAccountClass;
  normalBalance: NormalBalance;
  description: string;
  parentAccountId: string | null;
  sortOrder: number;
  isActive: boolean;
}

const emptyForm: LedgerAccountForm = {
  number: "",
  name: "",
  accountClass: "Asset",
  normalBalance: "Debit",
  description: "",
  parentAccountId: null,
  sortOrder: 0,
  isActive: true,
};

export default function LedgerAccountsPage() {
  const t = useTranslations("finance");
  const ta = useTranslations("finance.accounting");
  const router = useRouter();
  const { canReadFinance, canWriteFinance } = useAuth();
  const api = useApiClient();

  const apiRef = useRef(api);
  apiRef.current = api;

  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<LedgerAccount | null>(null);
  const [form, setForm] = useState<LedgerAccountForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [modeChecked, setModeChecked] = useState(false);

  // Guard: redirect if DoubleEntry is not enabled
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiRef.current.get("/api/v1/finance/profile");
        if (!cancelled && (!res.data || (res.data as { accountingMode?: string }).accountingMode !== "DoubleEntry")) {
          router.replace("/finance/settings");
          return;
        }
      } catch {
        if (!cancelled) router.replace("/finance/settings");
        return;
      }
      if (!cancelled) setModeChecked(true);
    })();
    return () => { cancelled = true; };
  }, [router]);

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiRef.current.get("/api/v1/finance/ledger-accounts");
      if (res.error) throw new Error(res.error);
      // Handle both raw array and { items: [...] } wrapper
      const data = res.data;
      const list = Array.isArray(data)
        ? (data as LedgerAccount[])
        : ((data as { items?: LedgerAccount[] })?.items ?? []);
      setAccounts(list);
    } catch {
      setError(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!canReadFinance) {
      router.replace("/");
      return;
    }
    if (modeChecked) fetchAccounts();
  }, [canReadFinance, router, fetchAccounts, modeChecked]);

  const openCreate = () => {
    setEditingAccount(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (account: LedgerAccount) => {
    setEditingAccount(account);
    setForm({
      number: account.number,
      name: account.name,
      accountClass: account.accountClass,
      normalBalance: account.normalBalance,
      description: account.description ?? "",
      parentAccountId: account.parentAccountId,
      sortOrder: account.sortOrder ?? 0,
      isActive: account.isActive,
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
      const payload = {
        number: form.number,
        name: form.name,
        accountClass: form.accountClass,
        normalBalance: form.normalBalance,
        description: form.description || null,
        parentAccountId: form.parentAccountId || null,
        sortOrder: form.sortOrder,
      };
      let res;
      if (editingAccount) {
        res = await apiRef.current.put(
          `/api/v1/finance/ledger-accounts/${editingAccount.id}`,
          payload
        );
      } else {
        res = await apiRef.current.post("/api/v1/finance/ledger-accounts", payload);
      }
      if (res.error) {
        setError(res.error);
        return;
      }
      closeModal();
      await fetchAccounts();
    } catch {
      setError(t("saveError"));
    } finally {
      setSaving(false);
    }
  }, [editingAccount, form, fetchAccounts, t]);

  const handleDelete = useCallback(async () => {
    if (!deleteConfirmId) return;
    try {
      setDeleting(true);
      setError(null);
      await apiRef.current.delete(`/api/v1/finance/ledger-accounts/${deleteConfirmId}`);
      setDeleteConfirmId(null);
      await fetchAccounts();
    } catch {
      setError(t("deleteError"));
    } finally {
      setDeleting(false);
    }
  }, [deleteConfirmId, fetchAccounts, t]);

  const classBadge = (cls: LedgerAccountClass) => {
    const colors: Record<LedgerAccountClass, string> = {
      Asset: "bg-blue-100 text-blue-800",
      Liability: "bg-red-100 text-red-800",
      Equity: "bg-purple-100 text-purple-800",
      Revenue: "bg-green-100 text-green-800",
      Expense: "bg-amber-100 text-amber-800",
    };
    const labels: Record<LedgerAccountClass, string> = {
      Asset: ta("classAsset"),
      Liability: ta("classLiability"),
      Equity: ta("classEquity"),
      Revenue: ta("classRevenue"),
      Expense: ta("classExpense"),
    };
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[cls]}`}>
        {labels[cls]}
      </span>
    );
  };

  if (!canReadFinance) return null;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Back */}
        <Link href="/finance/settings" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t("backToSettings")}
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{ta("ledgerAccounts")}</h1>
            <p className="mt-1 text-sm text-gray-500">{ta("ledgerAccountsSubtitle")}</p>
          </div>
          {canWriteFinance && (
            <button
              onClick={openCreate}
              className="rounded-lg bg-orange-600 px-4 py-2 font-medium text-white transition-colors hover:bg-orange-700"
            >
              {ta("newLedgerAccount")}
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
          </div>
        )}

        {/* Empty */}
        {!loading && accounts.length === 0 && (
          <div className="rounded-xl bg-white p-6 text-center text-gray-500 shadow-sm">{ta("noLedgerAccounts")}</div>
        )}

        {/* Table */}
        {!loading && accounts.length > 0 && (
          <div className="overflow-x-auto rounded-xl bg-white p-6 shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 text-sm text-gray-500">
                  <th className="pb-3 font-medium">{ta("accountNumber")}</th>
                  <th className="pb-3 font-medium">{ta("accountName")}</th>
                  <th className="pb-3 font-medium">{ta("accountClass")}</th>
                  <th className="pb-3 font-medium">{ta("normalBalance")}</th>
                  <th className="pb-3 font-medium">{t("active")}</th>
                  {canWriteFinance && (
                    <th className="pb-3 text-right font-medium">{t("actions")}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {accounts.map((account) => (
                  <tr key={account.id} className="text-sm">
                    <td className="py-3 font-mono font-medium text-gray-900">{account.number}</td>
                    <td className="py-3 text-gray-900">{account.name}</td>
                    <td className="py-3">{classBadge(account.accountClass)}</td>
                    <td className="py-3 text-gray-600">
                      {account.normalBalance === "Debit" ? ta("debit") : ta("credit")}
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        account.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                      }`}>
                        {account.isActive ? t("active") : t("inactive")}
                      </span>
                    </td>
                    {canWriteFinance && (
                      <td className="space-x-2 py-3 text-right">
                        <button onClick={() => openEdit(account)} className="text-sm font-medium text-orange-600 hover:text-orange-700">
                          {t("edit")}
                        </button>
                        <button onClick={() => setDeleteConfirmId(account.id)} className="text-sm font-medium text-red-600 hover:text-red-700">
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
                {editingAccount ? ta("editLedgerAccount") : ta("newLedgerAccount")}
              </h2>
              <div className="space-y-3">
                {/* Number */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{ta("accountNumber")} *</label>
                  <input
                    type="text"
                    required
                    value={form.number}
                    onChange={(e) => setForm({ ...form, number: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    placeholder="1000"
                  />
                </div>
                {/* Name */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{ta("accountName")} *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
                {/* Description */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{ta("description")}</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
                {/* Account Class */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{ta("accountClass")}</label>
                  <select
                    value={form.accountClass}
                    onChange={(e) => {
                      const cls = e.target.value as LedgerAccountClass;
                      const nb: NormalBalance = cls === "Asset" || cls === "Expense" ? "Debit" : "Credit";
                      setForm({ ...form, accountClass: cls, normalBalance: nb });
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  >
                    <option value="Asset">{ta("classAsset")}</option>
                    <option value="Liability">{ta("classLiability")}</option>
                    <option value="Equity">{ta("classEquity")}</option>
                    <option value="Revenue">{ta("classRevenue")}</option>
                    <option value="Expense">{ta("classExpense")}</option>
                  </select>
                </div>
                {/* Normal Balance */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{ta("normalBalance")}</label>
                  <select
                    value={form.normalBalance}
                    onChange={(e) => setForm({ ...form, normalBalance: e.target.value as NormalBalance })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  >
                    <option value="Debit">{ta("debit")}</option>
                    <option value="Credit">{ta("credit")}</option>
                  </select>
                </div>
                {/* Parent Account */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{ta("parentAccount")}</label>
                  <select
                    value={form.parentAccountId ?? ""}
                    onChange={(e) => setForm({ ...form, parentAccountId: e.target.value || null })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  >
                    <option value="">{ta("noParentAccount")}</option>
                    {accounts
                      .filter((a) => a.id !== editingAccount?.id)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.number} – {a.name}
                        </option>
                      ))}
                  </select>
                </div>
                {/* IsActive (only for edit) */}
                {editingAccount && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                    />
                    <label htmlFor="isActive" className="text-sm font-medium text-gray-700">{t("active")}</label>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={closeModal} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200">
                  {t("cancel")}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.number || !form.name}
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
                <button onClick={() => setDeleteConfirmId(null)} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200">
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
