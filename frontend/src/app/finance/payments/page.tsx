"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, useApiClient } from "@/lib/auth";

interface Payment {
  id: string;
  date: string;
  amount: number;
  method: string;
  reference: string;
  notes: string;
  invoiceId: string;
  invoiceNumber: string;
  transactionId: string | null;
}

interface OpenInvoice {
  id: string;
  invoiceNumber: string;
  recipientName: string;
  dueDate: string;
  total: number;
  paidAmount: number;
}

type PaymentMethod = "BankTransfer" | "Cash" | "Card" | "Other";

const formatCHF = (amount: number) =>
  new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(
    amount
  );

export default function PaymentsPage() {
  const t = useTranslations("finance");
  const { canReadFinance, canWriteFinance } = useAuth();
  const api = useApiClient();
  const router = useRouter();

  const tRef = useRef(t);
  tRef.current = t;
  const apiRef = useRef(api);
  apiRef.current = api;

  const [activeTab, setActiveTab] = useState<"open" | "all">("open");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [formData, setFormData] = useState({
    invoiceId: "",
    date: new Date().toISOString().split("T")[0],
    amount: 0,
    method: "BankTransfer" as PaymentMethod,
    reference: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchOpenInvoices = useCallback(async () => {
    try {
      const res = await apiRef.current.get("/api/v1/finance/invoices/open");
      if (res.error) throw new Error(res.error);
      setOpenInvoices(res.data as OpenInvoice[]);
    } catch {
      setError("Failed to load open invoices");
    }
  }, []);

  const fetchPayments = useCallback(async () => {
    try {
      const res = await apiRef.current.get("/api/v1/finance/payments");
      if (res.error) throw new Error(res.error);
      setPayments(res.data as Payment[]);
    } catch {
      setError("Failed to load payments");
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    await Promise.all([fetchOpenInvoices(), fetchPayments()]);
    setLoading(false);
  }, [fetchOpenInvoices, fetchPayments]);

  useEffect(() => {
    if (canReadFinance) {
      loadData();
    }
  }, [canReadFinance, loadData]);

  const openRecordModal = useCallback((invoice?: OpenInvoice) => {
    setEditingPayment(null);
    setFormData({
      invoiceId: invoice?.id ?? "",
      date: new Date().toISOString().split("T")[0],
      amount: invoice ? invoice.total - invoice.paidAmount : 0,
      method: "BankTransfer",
      reference: "",
      notes: "",
    });
    setShowModal(true);
  }, []);

  const openEditModal = useCallback((payment: Payment) => {
    setEditingPayment(payment);
    setFormData({
      invoiceId: payment.invoiceId,
      date: payment.date.split("T")[0],
      amount: payment.amount,
      method: payment.method as PaymentMethod,
      reference: payment.reference,
      notes: payment.notes,
    });
    setShowModal(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      if (editingPayment) {
        await apiRef.current.put(
          `/api/v1/finance/payments/${editingPayment.id}`,
          formData
        );
      } else {
        await apiRef.current.post("/api/v1/finance/payments", formData);
      }
      setShowModal(false);
      await loadData();
    } catch {
      setError("Failed to save payment");
    } finally {
      setSubmitting(false);
    }
  }, [editingPayment, formData, loadData]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await apiRef.current.delete(`/api/v1/finance/payments/${id}`);
        await loadData();
      } catch {
        setError("Failed to delete payment");
      }
    },
    [loadData]
  );

  const methodBadge = (method: string) => {
    const colors: Record<string, string> = {
      BankTransfer: "bg-blue-100 text-blue-800",
      Cash: "bg-green-100 text-green-800",
      Card: "bg-purple-100 text-purple-800",
      Other: "bg-gray-100 text-gray-800",
    };
    const labels: Record<string, () => string> = {
      BankTransfer: () => tRef.current("bankTransfer"),
      Cash: () => tRef.current("cashPayment"),
      Card: () => tRef.current("cardPayment"),
      Other: () => method,
    };
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[method] ?? colors.Other}`}
      >
        {(labels[method] ?? labels.Other)()}
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
        {error && (
          <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            <span>{error}</span>
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

        {/* Loading */}
        {loading && (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-orange-600" />
          </div>
        )}

        {/* Open Items Tab */}
        {!loading && activeTab === "open" && (
          <div className="rounded-xl bg-white p-6 shadow-sm">
            {openInvoices.length === 0 ? (
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
                    {openInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {inv.invoiceNumber}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {inv.recipientName}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(inv.dueDate).toLocaleDateString("de-CH")}
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
        )}

        {/* All Payments Tab */}
        {!loading && activeTab === "all" && (
          <div className="rounded-xl bg-white p-6 shadow-sm">
            {payments.length === 0 ? (
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
                        {t("method")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Reference
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Invoice #
                      </th>
                      {canWriteFinance && (
                        <th className="px-4 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {new Date(p.date).toLocaleDateString("de-CH")}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-900">
                          {formatCHF(p.amount)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {methodBadge(p.method)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {p.reference}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {p.invoiceNumber}
                        </td>
                        {canWriteFinance && (
                          <td className="space-x-2 px-4 py-3 text-right">
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
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Record / Edit Payment Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-lg">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingPayment ? "Edit Payment" : t("recordPayment")}
              </h2>

              {/* Invoice Selection */}
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
                      };
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
                >
                  <option value="">-- Select Invoice --</option>
                  {openInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} — {inv.recipientName} (
                      {formatCHF(inv.total - inv.paidAmount)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
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

              {/* Amount */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Amount (CHF)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      amount: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
                />
              </div>

              {/* Method */}
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
                  <option value="BankTransfer">{t("bankTransfer")}</option>
                  <option value="Cash">{t("cashPayment")}</option>
                  <option value="Card">{t("cardPayment")}</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Reference */}
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

              {/* Notes */}
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

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !formData.invoiceId}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? (
                    <span className="inline-flex items-center">
                      <span className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                      Saving…
                    </span>
                  ) : editingPayment ? (
                    "Save"
                  ) : (
                    t("recordPayment")
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
