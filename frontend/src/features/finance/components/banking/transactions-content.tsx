"use client";

/**
 * Finance Transactions content (E26-S5 migration of `app/finance/transactions/page.tsx`).
 * Composition root (only `"use client"`) — self-embeds its own `QueryClientProvider`.
 *
 * Guard: CANONICAL (isAuthenticated + authLoading + canReadFinance/canWriteFinance;
 *   `router.push("/")`; spinner while `authLoading || (loading && transactions.length===0)`;
 *   then `if (!isAuthenticated || !canReadFinance) return null`).
 * Server filters via URLSearchParams (in the api layer; the list query keys on the filter
 *   object). Client search applied during render. Create/edit form = E22 RHF+Zod (A95/A96).
 *   Delete-confirm modal = red. Receipt attach modal = mutually-exclusive pick/upload; the
 *   upload uses `api.upload` (FormData "file"+"notes"). Receipt preview/download helper is
 *   imperative (image/PDF → modal w/ deferred revoke; else APPENDED anchor download + revoke).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { formatCHF } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import {
  useDeleteTransaction,
  useSaveTransaction,
  useTransactionAccounts,
  useTransactionActivityAreas,
  useTransactionCategories,
  useTransactions,
  useAttachReceipt,
  useDetachReceipt,
} from "../../hooks/use-transactions";
import {
  useReceiptsForAttach,
  useUploadTransactionReceipt,
  useViewReceipt,
} from "../../hooks/use-transaction-receipts";
import type {
  Transaction,
  TransactionFilters,
  TransactionPayload,
} from "../../types/banking.types";
import type { TransactionFormValues } from "../../schemas/transaction.schema";
import { TransactionForm } from "./transaction-form";

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

const ReceiptIcon = ({ className }: { className?: string }) => (
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
      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
    />
  </svg>
);

const emptyForm: TransactionFormValues = {
  date: new Date().toISOString().split("T")[0],
  description: "",
  amount: "",
  type: "Expense",
  accountId: "",
  categoryId: "",
  reference: "",
  notes: "",
  activityAreaId: "",
};

function TransactionsBody() {
  const t = useTranslations("finance");
  const router = useRouter();
  const {
    isAuthenticated,
    isLoading: authLoading,
    canReadFinance,
    canWriteFinance,
  } = useAuth();

  const enabled = isAuthenticated && canReadFinance;

  // --- Filters ---
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterType, setFilterType] = useState<"" | "Income" | "Expense">("");
  const [filterAccountId, setFilterAccountId] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const filters: TransactionFilters = useMemo(
    () => ({
      from: filterFrom,
      to: filterTo,
      type: filterType,
      accountId: filterAccountId,
      categoryId: filterCategoryId,
    }),
    [filterFrom, filterTo, filterType, filterAccountId, filterCategoryId]
  );

  const accountsQuery = useTransactionAccounts(enabled);
  const categoriesQuery = useTransactionCategories(enabled);
  const activityAreasQuery = useTransactionActivityAreas(enabled);
  const transactionsQuery = useTransactions(enabled, filters);

  const accounts = accountsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const activityAreas = activityAreasQuery.data ?? [];
  const transactions = transactionsQuery.data ?? [];
  const loading = enabled && transactionsQuery.isLoading;

  const saveTransaction = useSaveTransaction();
  const deleteTransaction = useDeleteTransaction();
  const attachReceipt = useAttachReceipt();
  const detachReceipt = useDetachReceipt();
  const uploadReceipt = useUploadTransactionReceipt();

  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formInitial, setFormInitial] =
    useState<TransactionFormValues>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirmation
  const [deletingTransaction, setDeletingTransaction] =
    useState<Transaction | null>(null);

  // Receipt attachment
  const [receiptModalTx, setReceiptModalTx] = useState<Transaction | null>(
    null
  );
  const [selectedReceiptId, setSelectedReceiptId] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptNotes, setReceiptNotes] = useState("");
  const [receiptSaving, setReceiptSaving] = useState(false);

  const receiptsQuery = useReceiptsForAttach(!!receiptModalTx);
  const receipts = receiptsQuery.data ?? [];

  // Receipt preview
  const [previewModal, setPreviewModal] = useState<{
    url: string;
    type: string;
    name: string;
  } | null>(null);

  const handleViewReceipt = useViewReceipt(setPreviewModal, setError);

  const saving = saveTransaction.isPending || deleteTransaction.isPending;

  // The list-load error (the god-page sets `error` from `res.error`) is DERIVED here as a
  // banner fallback — no setState-in-effect. `error` carries the action-triggered errors.
  const loadError = transactionsQuery.isError
    ? transactionsQuery.error instanceof Error
      ? transactionsQuery.error.message
      : "Failed to load transactions"
    : null;
  const banner = error ?? loadError;

  // --- Auth guard ---
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !canReadFinance)) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, canReadFinance, router]);

  // --- Modal handlers ---
  const openCreateModal = () => {
    setFormInitial(emptyForm);
    setEditingTransaction(null);
    setFormError(null);
    setShowCreateModal(true);
  };

  const openEditModal = (tx: Transaction) => {
    setFormInitial({
      date: tx.date.split("T")[0],
      description: tx.description,
      amount: tx.amount.toString(),
      type: tx.type,
      accountId: tx.accountId,
      categoryId: tx.categoryId,
      reference: tx.reference || "",
      notes: tx.notes || "",
      activityAreaId: tx.activityAreaId || "",
    });
    setEditingTransaction(tx);
    setFormError(null);
    setShowCreateModal(true);
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingTransaction(null);
    setFormError(null);
  };

  const handleSubmitPayload = (payload: TransactionPayload) => {
    setFormError(null);
    saveTransaction.mutate(
      { id: editingTransaction?.id ?? null, payload },
      {
        onSuccess: (res) => {
          if (res.error) {
            setFormError(res.error);
            return;
          }
          closeModal();
        },
        onError: () => setFormError("An unexpected error occurred"),
      }
    );
  };

  const handleDeleteConfirm = () => {
    if (!deletingTransaction) return;
    deleteTransaction.mutate(deletingTransaction.id, {
      onSuccess: (res) => {
        if (res.error) setError(res.error);
        setDeletingTransaction(null);
      },
      onError: () => {
        setError("Failed to delete transaction");
        setDeletingTransaction(null);
      },
    });
  };

  // --- Receipt handlers ---
  const openReceiptModal = (tx: Transaction) => {
    setReceiptModalTx(tx);
    setSelectedReceiptId("");
    setReceiptFile(null);
    setReceiptNotes("");
  };

  const closeReceiptModal = () => {
    setReceiptModalTx(null);
    setSelectedReceiptId("");
    setReceiptFile(null);
    setReceiptNotes("");
  };

  const handleAttachReceipt = async () => {
    if (!receiptModalTx) return;
    setReceiptSaving(true);
    try {
      let receiptId = selectedReceiptId;
      // If a file is selected (and no existing picked), upload it first.
      if (receiptFile && !selectedReceiptId) {
        const uploadRes = await uploadReceipt.mutateAsync({
          file: receiptFile,
          notes: receiptNotes,
        });
        if (uploadRes.error || !uploadRes.data) {
          setError(uploadRes.error || "Upload failed");
          setReceiptSaving(false);
          return;
        }
        receiptId = uploadRes.data.id;
      }
      if (!receiptId) {
        setReceiptSaving(false);
        return;
      }
      const res = await attachReceipt.mutateAsync({
        transactionId: receiptModalTx.id,
        receiptId,
      });
      if (res.error) {
        setError(res.error);
      } else {
        closeReceiptModal();
      }
    } catch {
      setError("Failed to attach receipt");
    } finally {
      setReceiptSaving(false);
    }
  };

  const handleDetachReceipt = (tx: Transaction) => {
    detachReceipt.mutate(tx.id, {
      onSuccess: (res) => {
        if (res.error) setError(res.error);
      },
      onError: () => setError("Failed to detach receipt"),
    });
  };

  const closePreviewModal = () => {
    if (previewModal) URL.revokeObjectURL(previewModal.url);
    setPreviewModal(null);
  };

  // --- Loading & auth guard ---
  if (authLoading || (loading && transactions.length === 0)) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex min-h-100 items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated || !canReadFinance) {
    return null;
  }

  const lowerSearch = searchTerm.toLowerCase();
  const filteredTransactions = searchTerm
    ? transactions.filter((tx) => {
        const amountStr = tx.amount.toFixed(2);
        return (
          tx.description.toLowerCase().includes(lowerSearch) ||
          tx.categoryName.toLowerCase().includes(lowerSearch) ||
          tx.accountName.toLowerCase().includes(lowerSearch) ||
          (tx.reference && tx.reference.toLowerCase().includes(lowerSearch)) ||
          (tx.notes && tx.notes.toLowerCase().includes(lowerSearch)) ||
          (tx.activityAreaName &&
            tx.activityAreaName.toLowerCase().includes(lowerSearch)) ||
          (tx.activityAreaCode &&
            tx.activityAreaCode.toLowerCase().includes(lowerSearch)) ||
          amountStr.includes(lowerSearch)
        );
      })
    : transactions;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            {t("transactions")}
          </h1>
          {canWriteFinance && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-white transition-colors hover:bg-orange-700"
            >
              <PlusIcon className="h-5 w-5" />
              {t("newTransaction")}
            </button>
          )}
        </div>

        {/* Error banner */}
        {banner && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {banner}
          </div>
        )}

        {/* Filters */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <div className="relative mb-4">
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
              placeholder={t("searchTransactions")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-10 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* Date from */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("from")}
              </label>
              <input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
              />
            </div>

            {/* Date to */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("to")}
              </label>
              <input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
              />
            </div>

            {/* Type filter */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("filterByType")}
              </label>
              <select
                value={filterType}
                onChange={(e) =>
                  setFilterType(e.target.value as "" | "Income" | "Expense")
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
              >
                <option value="">{t("allTypes")}</option>
                <option value="Income">{t("income")}</option>
                <option value="Expense">{t("expense")}</option>
              </select>
            </div>

            {/* Account filter */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("account")}
              </label>
              <select
                value={filterAccountId}
                onChange={(e) => setFilterAccountId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
              >
                <option value="">{t("allTypes")}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Category filter */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("category")}
              </label>
              <select
                value={filterCategoryId}
                onChange={(e) => setFilterCategoryId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
              >
                <option value="">{t("allTypes")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Transactions table */}
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-orange-600"></div>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              {t("noTransactions")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-700">
                      {t("date")}
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-700">
                      {t("description")}
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-gray-700">
                      {t("amount")}
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-700">
                      {t("type")}
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-700">
                      {t("category")}
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-700">
                      {t("account")}
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-700">
                      {t("activityArea")}
                    </th>
                    <th className="px-4 py-3 text-center font-medium text-gray-700">
                      <ReceiptIcon className="inline h-4 w-4" />
                    </th>
                    {canWriteFinance && (
                      <th className="px-4 py-3 font-medium text-gray-700">
                        {t("actions")}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTransactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="transition-colors hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                        {new Date(tx.date).toLocaleDateString("de-CH")}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-gray-900">
                        {tx.description}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-medium whitespace-nowrap ${
                          tx.type === "Income"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {tx.type === "Income" ? "+" : "-"}
                        {formatCHF(tx.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            tx.type === "Income"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {t(tx.type === "Income" ? "income" : "expense")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {tx.categoryName}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {tx.accountName}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {tx.activityAreaCode ? (
                          <span className="text-xs">
                            <span className="font-mono font-medium">
                              {tx.activityAreaCode}
                            </span>
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {tx.receiptId ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleViewReceipt(tx.receiptId!)}
                              className="rounded p-0.5 text-orange-600 transition-colors hover:bg-orange-50 hover:text-orange-800"
                              title={t("viewReceipt")}
                            >
                              <ReceiptIcon className="inline h-4 w-4" />
                            </button>
                            {canWriteFinance && (
                              <button
                                onClick={() => handleDetachReceipt(tx)}
                                className="rounded p-0.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                                title={t("detachReceipt")}
                              >
                                <svg
                                  className="h-3 w-3"
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
                              </button>
                            )}
                          </div>
                        ) : canWriteFinance ? (
                          <button
                            onClick={() => openReceiptModal(tx)}
                            className="rounded p-1 text-gray-400 transition-colors hover:bg-orange-50 hover:text-orange-600"
                            title={t("attachReceipt")}
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
                                d="M12 4v16m8-8H4"
                              />
                            </svg>
                          </button>
                        ) : null}
                      </td>
                      {canWriteFinance && (
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditModal(tx)}
                              className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-orange-600"
                              title={t("editTransaction")}
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeletingTransaction(tx)}
                              className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-red-600"
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
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showCreateModal && (
        <TransactionForm
          isEditing={!!editingTransaction}
          defaultValues={formInitial}
          accounts={accounts}
          categories={categories}
          activityAreas={activityAreas}
          saving={saveTransaction.isPending}
          formError={formError}
          onSubmitPayload={handleSubmitPayload}
          onCancel={closeModal}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">
              {t("delete")}
            </h2>
            <p className="mb-6 text-sm text-gray-600">
              {t("confirmDelete")}:{" "}
              <strong>{deletingTransaction.description}</strong>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingTransaction(null)}
                disabled={saving}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={saving}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? "…" : t("delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Attachment Modal */}
      {receiptModalTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              {t("attachReceiptTitle")}
            </h2>
            <p className="mb-4 text-sm text-gray-600">
              {receiptModalTx.description}
            </p>

            {/* Select existing receipt */}
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("selectExistingReceipt")}
              </label>
              <select
                value={selectedReceiptId}
                onChange={(e) => {
                  setSelectedReceiptId(e.target.value);
                  if (e.target.value) setReceiptFile(null);
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
              >
                <option value="">—</option>
                {receipts.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.fileName} (
                    {new Date(r.createdAt).toLocaleDateString("de-CH")})
                  </option>
                ))}
              </select>
            </div>

            {/* Or upload new */}
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("orUploadNew")}
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.tiff"
                onChange={(e) => {
                  setReceiptFile(e.target.files?.[0] ?? null);
                  if (e.target.files?.[0]) setSelectedReceiptId("");
                }}
                className="w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-orange-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-orange-700 hover:file:bg-orange-100"
              />
              {receiptFile && (
                <input
                  type="text"
                  placeholder={t("notes")}
                  value={receiptNotes}
                  onChange={(e) => setReceiptNotes(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                />
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeReceiptModal}
                disabled={receiptSaving}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleAttachReceipt}
                disabled={receiptSaving || (!selectedReceiptId && !receiptFile)}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
              >
                {receiptSaving ? "…" : t("uploadAndAttach")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Preview Modal */}
      {previewModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
          <div
            className="relative flex w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl"
            style={{ maxHeight: "90vh" }}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="truncate text-lg font-semibold text-gray-900">
                {previewModal.name}
              </h2>
              <div className="flex items-center gap-2">
                <a
                  href={previewModal.url}
                  download={previewModal.name}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  {t("downloadReceipt")}
                </a>
                <button
                  onClick={closePreviewModal}
                  className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                >
                  <svg
                    className="h-5 w-5"
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
                </button>
              </div>
            </div>
            <div
              className="overflow-auto p-4"
              style={{ maxHeight: "calc(90vh - 5rem)" }}
            >
              {previewModal.type.startsWith("image/") ? (
                <Image
                  src={previewModal.url}
                  alt={previewModal.name}
                  width={0}
                  height={0}
                  sizes="100vw"
                  className="mx-auto h-auto w-auto max-w-full rounded"
                  unoptimized
                />
              ) : (
                <iframe
                  src={previewModal.url}
                  title={previewModal.name}
                  className="h-[70vh] w-full rounded border-0"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export function TransactionsContent() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <TransactionsBody />
    </QueryClientProvider>
  );
}
