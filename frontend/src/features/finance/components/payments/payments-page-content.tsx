"use client";

/**
 * Payments content (E26-S3 migration of `app/finance/payments/page.tsx`).
 * Composition root (only `"use client"`) — self-embeds its own `QueryClientProvider`.
 *
 * Inline "Not authorized" read guard (A56): reads `canReadFinance` ONLY; NO redirect, NO
 * `return null` — renders a centered literal-English "Not authorized" div. HARDCODED-ENGLISH
 * error strings are preserved VERBATIM (NOT i18n keys). Status×role action matrix:
 * approve/reject only when (isVorstand||isAdmin) AND status==="Submitted". IMMEDIATE
 * no-confirm: Delete (Draft) + receipt-detach. Reject is a two-step modal. Affordance
 * colours (A86): submit=yellow, approve=blue, reject=red, mark-paid=green, edit=orange,
 * delete=red. All modal reset/close driven from onSuccess (A92).
 */

import { useCallback, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useApiClient, useAuth } from "@/lib/auth";
import { formatCHF } from "@/lib/utils";
import { receivablesUrls } from "../../api/receivables-api";
import {
  useAttachReceipt,
  useDetachReceipt,
  useOpenInvoices,
  usePaymentAction,
  usePayments,
  useRejectPayment,
  useSavePayment,
} from "../../hooks/use-payments";
import type {
  Payment,
  PaymentDirectionType,
  PaymentFormData,
  PaymentMethod,
  Receipt,
} from "../../types/receivables.types";

type PaymentStatus = Payment["status"];

function PaymentsBody() {
  const t = useTranslations("finance");
  const tp = useTranslations("paymentApproval");
  const { canReadFinance, canWriteFinance, isVorstand, isAdmin } = useAuth();
  const api = useApiClient();

  const openInvoicesQuery = useOpenInvoices(canReadFinance);
  const paymentsQuery = usePayments(canReadFinance);
  const openInvoices = openInvoicesQuery.data ?? [];
  const payments = paymentsQuery.data ?? [];
  const loading =
    canReadFinance && (openInvoicesQuery.isLoading || paymentsQuery.isLoading);

  const saveMutation = useSavePayment();
  const actionMutation = usePaymentAction();
  const rejectMutation = useRejectPayment();
  const attachMutation = useAttachReceipt();
  const detachMutation = useDetachReceipt();

  const [activeTab, setActiveTab] = useState<"open" | "all">("open");
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Surface the per-leg hardcoded-English load errors VERBATIM (god-page parity) via a
  // DERIVED banner (not an effect — A: no setState-in-effect). A manual action error takes
  // precedence; otherwise the failing query leg's literal-English string shows.
  const banner =
    error ??
    (openInvoicesQuery.isError
      ? "Failed to load open invoices"
      : paymentsQuery.isError
        ? "Failed to load payments"
        : null);

  const [showModal, setShowModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [formData, setFormData] = useState<PaymentFormData>({
    invoiceId: "",
    date: new Date().toISOString().split("T")[0],
    amount: 0,
    direction: "Expense",
    method: "Transfer",
    reference: "",
    notes: "",
  });
  const [quickPay, setQuickPay] = useState(false);

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectPaymentId, setRejectPaymentId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [receiptModalPayment, setReceiptModalPayment] =
    useState<Payment | null>(null);
  const [availableReceipts, setAvailableReceipts] = useState<Receipt[]>([]);
  const [selectedReceiptId, setSelectedReceiptId] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptNotes, setReceiptNotes] = useState("");

  const [previewModal, setPreviewModal] = useState<{
    url: string;
    type: string;
    name: string;
  } | null>(null);

  const submitting = saveMutation.isPending;
  const receiptSaving = attachMutation.isPending;

  const openRecordModal = useCallback(
    (invoice?: { id: string; total: number; paidAmount: number }) => {
      setEditingPayment(null);
      setQuickPay(false);
      setFormData({
        invoiceId: invoice?.id ?? "",
        date: new Date().toISOString().split("T")[0],
        amount: invoice ? invoice.total - invoice.paidAmount : 0,
        direction: invoice ? "Income" : "Expense",
        method: "Transfer",
        reference: "",
        notes: "",
      });
      setShowModal(true);
    },
    []
  );

  const openEditModal = useCallback((payment: Payment) => {
    setEditingPayment(payment);
    setFormData({
      invoiceId: payment.invoiceId,
      date: payment.date.split("T")[0],
      amount: payment.amount,
      direction: (payment.direction as PaymentDirectionType) || "Expense",
      method: payment.method as PaymentMethod,
      reference: payment.reference,
      notes: payment.notes,
    });
    setShowModal(true);
  }, []);

  const handleSubmit = () => {
    saveMutation.mutate(
      { editingId: editingPayment?.id ?? null, formData, quickPay },
      {
        onSuccess: () => setShowModal(false),
        onError: () => setError("Failed to save payment"),
      }
    );
  };

  const handleDelete = (id: string) => {
    actionMutation.mutate(
      { type: "delete", id },
      { onError: () => setError("Failed to delete payment") }
    );
  };

  const handleSubmitForApproval = (id: string) => {
    actionMutation.mutate(
      { type: "submit", id },
      { onError: () => setError("Failed to submit payment for approval") }
    );
  };

  const handleApprove = (id: string) => {
    actionMutation.mutate(
      { type: "approve", id },
      { onError: () => setError("Failed to approve payment") }
    );
  };

  const handleMarkAsPaid = (id: string) => {
    actionMutation.mutate(
      { type: "mark-paid", id },
      { onError: () => setError("Failed to mark payment as paid") }
    );
  };

  const handleReject = () => {
    if (!rejectPaymentId || !rejectReason.trim()) return;
    rejectMutation.mutate(
      { id: rejectPaymentId, reason: rejectReason.trim() },
      {
        onSuccess: () => {
          setShowRejectModal(false);
          setRejectPaymentId(null);
          setRejectReason("");
        },
        onError: () => setError("Failed to reject payment"),
      }
    );
  };

  const canApproveOrReject = isVorstand || isAdmin;

  const fetchReceipts = useCallback(async () => {
    try {
      const res = await api.get<Receipt[]>(receivablesUrls.receipts());
      if (res.data) {
        const body = res.data as unknown as { items: Receipt[] };
        setAvailableReceipts(body.items ?? []);
      }
    } catch {
      /* ignore */
    }
  }, [api]);

  const openReceiptModal = useCallback(
    async (payment: Payment) => {
      setReceiptModalPayment(payment);
      setSelectedReceiptId("");
      setReceiptFile(null);
      setReceiptNotes("");
      await fetchReceipts();
    },
    [fetchReceipts]
  );

  const closeReceiptModal = () => {
    setReceiptModalPayment(null);
    setSelectedReceiptId("");
    setReceiptFile(null);
    setReceiptNotes("");
  };

  const handleAttachReceipt = () => {
    if (!receiptModalPayment) return;
    attachMutation.mutate(
      {
        paymentId: receiptModalPayment.id,
        selectedReceiptId,
        file: receiptFile,
        notes: receiptNotes,
      },
      {
        onSuccess: () => closeReceiptModal(),
        onError: (e) => setError(e.message || "Failed to attach receipt"),
      }
    );
  };

  const handleDetachReceipt = (payment: Payment) => {
    detachMutation.mutate(payment.id, {
      onError: (e) => setError(e.message || "Failed to detach receipt"),
    });
  };

  const handleViewReceipt = useCallback(
    async (receiptId: string) => {
      try {
        const infoRes = await api.get<Receipt>(
          receivablesUrls.receipt(receiptId)
        );
        const receipt = infoRes.data as Receipt | null;
        const contentType = receipt?.contentType ?? "";
        const fileName = receipt?.fileName ?? "receipt";

        const res = await api.get<Blob>(
          receivablesUrls.receiptDownload(receiptId)
        );
        if (res.error || !res.data) return;
        const blob = res.data as Blob;
        const url = URL.createObjectURL(blob);

        if (
          contentType.startsWith("image/") ||
          contentType === "application/pdf"
        ) {
          setPreviewModal({ url, type: contentType, name: fileName });
        } else {
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      } catch {
        setError("Failed to load receipt");
      }
    },
    [api]
  );

  const closePreviewModal = useCallback(() => {
    if (previewModal) URL.revokeObjectURL(previewModal.url);
    setPreviewModal(null);
  }, [previewModal]);

  const statusBadge = (status: PaymentStatus) => {
    const colors: Record<PaymentStatus, string> = {
      Draft: "bg-gray-100 text-gray-800",
      Submitted: "bg-yellow-100 text-yellow-800",
      Approved: "bg-blue-100 text-blue-800",
      Rejected: "bg-red-100 text-red-800",
      Paid: "bg-green-100 text-green-800",
    };
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-800"}`}
      >
        {tp(
          status.toLowerCase() as
            | "draft"
            | "submitted"
            | "approved"
            | "rejected"
            | "paid"
        )}
      </span>
    );
  };

  const methodBadge = (method: string) => {
    const colors: Record<string, string> = {
      Transfer: "bg-blue-100 text-blue-800",
      Cash: "bg-green-100 text-green-800",
      Online: "bg-purple-100 text-purple-800",
    };
    const labels: Record<string, () => string> = {
      Transfer: () => t("bankTransfer"),
      Cash: () => t("cashPayment"),
      Online: () => t("cardPayment"),
    };
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[method] ?? "bg-gray-100 text-gray-800"}`}
      >
        {(labels[method] ?? (() => method))()}
      </span>
    );
  };

  const directionBadge = (direction: string) => {
    const isIncome = direction === "Income";
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
          isIncome ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
        }`}
      >
        {isIncome ? t("directionIncome") : t("directionExpense")}
      </span>
    );
  };

  if (!canReadFinance) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        Not authorized
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{t("payments")}</h1>
          {canWriteFinance && (
            <button
              onClick={() => openRecordModal()}
              className="inline-flex items-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700"
            >
              {t("recordPayment")}
            </button>
          )}
        </div>

        {/* Error Banner */}
        {banner && (
          <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            <span>{banner}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("open")}
              className={`border-b-2 px-1 py-2 text-sm font-medium ${
                activeTab === "open"
                  ? "border-orange-600 text-orange-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {t("openItems")}
            </button>
            <button
              onClick={() => setActiveTab("all")}
              className={`border-b-2 px-1 py-2 text-sm font-medium ${
                activeTab === "all"
                  ? "border-orange-600 text-orange-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {t("allPayments")}
            </button>
          </nav>
        </div>

        {/* Search */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
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
              placeholder={t("searchPayments")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-10 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-orange-600" />
          </div>
        )}

        {/* Open Items Tab */}
        {!loading &&
          activeTab === "open" &&
          (() => {
            const term = searchTerm.toLowerCase();
            const filteredOpen = term
              ? openInvoices.filter(
                  (inv) =>
                    inv.invoiceNumber.toLowerCase().includes(term) ||
                    inv.recipientName.toLowerCase().includes(term) ||
                    formatCHF(inv.total).toLowerCase().includes(term) ||
                    formatCHF(inv.paidAmount).toLowerCase().includes(term) ||
                    formatCHF(inv.total - inv.paidAmount)
                      .toLowerCase()
                      .includes(term) ||
                    new Date(inv.dueDate)
                      .toLocaleDateString("de-CH")
                      .includes(term)
                )
              : openInvoices;
            return (
              <div className="rounded-xl bg-white p-6 shadow-sm">
                {filteredOpen.length === 0 ? (
                  <div className="py-12 text-center text-gray-500">
                    {t("noOpenItems")}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                            Invoice #
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                            Recipient
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                            Due Date
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                            Total
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                            Paid
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                            {t("remaining")}
                          </th>
                          {canWriteFinance && (
                            <th className="px-4 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                              Action
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {filteredOpen.map((inv) => (
                          <tr key={inv.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {inv.invoiceNumber}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {inv.recipientName}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {new Date(inv.dueDate).toLocaleDateString(
                                "de-CH"
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-gray-900">
                              {formatCHF(inv.total)}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-gray-900">
                              {formatCHF(inv.paidAmount)}
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-medium text-red-600">
                              {formatCHF(inv.total - inv.paidAmount)}
                            </td>
                            {canWriteFinance && (
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() => openRecordModal(inv)}
                                  className="text-sm font-medium text-orange-600 hover:text-orange-800"
                                >
                                  {t("pay")}
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}

        {/* All Payments Tab */}
        {!loading &&
          activeTab === "all" &&
          (() => {
            const term = searchTerm.toLowerCase();
            const filteredPayments = term
              ? payments.filter(
                  (p) =>
                    formatCHF(p.amount).toLowerCase().includes(term) ||
                    p.reference.toLowerCase().includes(term) ||
                    p.invoiceNumber.toLowerCase().includes(term) ||
                    p.notes.toLowerCase().includes(term) ||
                    p.direction.toLowerCase().includes(term) ||
                    p.method.toLowerCase().includes(term) ||
                    p.status.toLowerCase().includes(term) ||
                    new Date(p.date).toLocaleDateString("de-CH").includes(term)
                )
              : payments;
            return (
              <div className="rounded-xl bg-white p-6 shadow-sm">
                {filteredPayments.length === 0 ? (
                  <div className="py-12 text-center text-gray-500">
                    {t("noPayments")}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                            Date
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                            Amount
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                            {t("direction")}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                            {t("method")}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                            {tp("status")}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                            Reference
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                            Invoice #
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium tracking-wider text-gray-500 uppercase">
                            {t("receipt")}
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {filteredPayments.map((p) => (
                          <tr key={p.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {new Date(p.date).toLocaleDateString("de-CH")}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-gray-900">
                              {formatCHF(p.amount)}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {directionBadge(p.direction)}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {methodBadge(p.method)}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {statusBadge(p.status)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {p.reference}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {p.invoiceNumber}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {p.receiptId ? (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() =>
                                      handleViewReceipt(p.receiptId!)
                                    }
                                    className="rounded p-0.5 text-orange-600 transition-colors hover:bg-orange-50 hover:text-orange-800"
                                    title={t("viewReceipt")}
                                  >
                                    <svg
                                      className="inline h-4 w-4"
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
                                  </button>
                                  {canWriteFinance && (
                                    <button
                                      onClick={() => handleDetachReceipt(p)}
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
                                  onClick={() => openReceiptModal(p)}
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
                            <td className="space-x-2 px-4 py-3 text-right whitespace-nowrap">
                              {p.status === "Draft" && canWriteFinance && (
                                <>
                                  <button
                                    onClick={() =>
                                      handleSubmitForApproval(p.id)
                                    }
                                    className="text-sm font-medium text-yellow-600 hover:text-yellow-800"
                                    title={tp("submit")}
                                  >
                                    {tp("submit")}
                                  </button>
                                  <button
                                    onClick={() => handleMarkAsPaid(p.id)}
                                    className="text-sm font-medium text-green-600 hover:text-green-800"
                                    title={tp("markPaid")}
                                  >
                                    {tp("markPaid")}
                                  </button>
                                </>
                              )}
                              {p.status === "Submitted" &&
                                canApproveOrReject && (
                                  <>
                                    <button
                                      onClick={() => handleApprove(p.id)}
                                      className="text-sm font-medium text-blue-600 hover:text-blue-800"
                                    >
                                      {tp("approve")}
                                    </button>
                                    <button
                                      onClick={() => {
                                        setRejectPaymentId(p.id);
                                        setRejectReason("");
                                        setShowRejectModal(true);
                                      }}
                                      className="text-sm font-medium text-red-600 hover:text-red-800"
                                    >
                                      {tp("reject")}
                                    </button>
                                  </>
                                )}
                              {p.status === "Approved" && canWriteFinance && (
                                <button
                                  onClick={() => handleMarkAsPaid(p.id)}
                                  className="text-sm font-medium text-green-600 hover:text-green-800"
                                >
                                  {tp("markPaid")}
                                </button>
                              )}
                              {p.status === "Paid" && (
                                <span className="text-sm text-green-600">
                                  ✓
                                </span>
                              )}
                              {p.status === "Rejected" && p.rejectionReason && (
                                <span
                                  className="cursor-help text-sm text-red-500"
                                  title={`${tp("rejectedBy")}: ${p.rejectedBy}\n${p.rejectionReason}`}
                                >
                                  ⓘ
                                </span>
                              )}
                              {p.status === "Draft" && canWriteFinance && (
                                <>
                                  <button
                                    onClick={() => openEditModal(p)}
                                    className="text-sm font-medium text-orange-600 hover:text-orange-800"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDelete(p.id)}
                                    className="text-sm font-medium text-red-600 hover:text-red-800"
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}

        {/* Record / Edit Payment Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-lg">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingPayment ? "Edit Payment" : t("recordPayment")}
              </h2>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Invoice
                </label>
                <select
                  value={formData.invoiceId}
                  onChange={(e) =>
                    setFormData((f) => {
                      const inv = openInvoices.find(
                        (i) => i.id === e.target.value
                      );
                      return {
                        ...f,
                        invoiceId: e.target.value,
                        amount: inv ? inv.total - inv.paidAmount : f.amount,
                        direction: e.target.value ? "Income" : f.direction,
                      };
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
                >
                  <option value="">-- {t("noInvoice")} --</option>
                  {openInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} — {inv.recipientName} (
                      {formatCHF(inv.total - inv.paidAmount)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Date
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, date: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("direction")}
                </label>
                <select
                  value={formData.direction}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      direction: e.target.value as PaymentDirectionType,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
                >
                  <option value="Income">{t("directionIncome")}</option>
                  <option value="Expense">{t("directionExpense")}</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Amount (CHF)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount || ""}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      amount: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("method")}
                </label>
                <select
                  value={formData.method}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      method: e.target.value as PaymentMethod,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
                >
                  <option value="Transfer">{t("bankTransfer")}</option>
                  <option value="Cash">{t("cashPayment")}</option>
                  <option value="Online">{t("cardPayment")}</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Reference
                </label>
                <input
                  type="text"
                  value={formData.reference}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, reference: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, notes: e.target.value }))
                  }
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
                />
              </div>

              {!editingPayment && (
                <div className="flex items-center space-x-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                  <input
                    type="checkbox"
                    id="quickPay"
                    checked={quickPay}
                    onChange={(e) => setQuickPay(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <label htmlFor="quickPay" className="text-sm text-green-800">
                    {tp("markPaid")} — {t("quickPayHint")}
                  </label>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || formData.amount <= 0}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? (
                    <span className="inline-flex items-center">
                      <span className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                      Saving…
                    </span>
                  ) : editingPayment ? (
                    "Save"
                  ) : quickPay ? (
                    tp("markPaid")
                  ) : (
                    t("recordPayment")
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Payment Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-lg">
              <h2 className="text-lg font-semibold text-gray-900">
                {tp("rejectTitle")}
              </h2>
              <p className="text-sm text-gray-600">{tp("rejectMessage")}</p>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {tp("reason")}
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder={tp("reasonPlaceholder")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-red-500"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectPaymentId(null);
                    setRejectReason("");
                  }}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={!rejectReason.trim()}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {tp("reject")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Receipt Attachment Modal */}
        {receiptModalPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-lg">
              <h2 className="text-lg font-semibold text-gray-900">
                {t("attachReceiptToPayment")}
              </h2>
              <p className="text-sm text-gray-600">
                {formatCHF(receiptModalPayment.amount)} —{" "}
                {new Date(receiptModalPayment.date).toLocaleDateString("de-CH")}
              </p>

              <div>
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
                  {availableReceipts.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.fileName} (
                      {new Date(r.createdAt).toLocaleDateString("de-CH")})
                    </option>
                  ))}
                </select>
              </div>

              <div>
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

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={closeReceiptModal}
                  disabled={receiptSaving}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={handleAttachReceipt}
                  disabled={
                    receiptSaving || (!selectedReceiptId && !receiptFile)
                  }
                  className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
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
      </div>
    </main>
  );
}

export function PaymentsPageContent() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <PaymentsBody />
    </QueryClientProvider>
  );
}
