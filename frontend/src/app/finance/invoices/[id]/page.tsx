"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, useApiClient } from "@/lib/auth";

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  status: string;
  recipientType: string;
  recipientName: string;
  recipientAddress: string;
  subTotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  items: InvoiceItem[];
}

interface Payment {
  id: string;
  date: string;
  amount: number;
  method: string;
  reference: string;
}

const formatCHF = (amount: number) =>
  new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(
    amount
  );

const statusColors: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-800",
  Sent: "bg-blue-100 text-blue-800",
  Paid: "bg-green-100 text-green-800",
  Overdue: "bg-red-100 text-red-800",
  Cancelled: "bg-yellow-100 text-yellow-800",
};

export default function InvoiceDetailPage() {
  const t = useTranslations("finance");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { canReadFinance, canWriteFinance } = useAuth();
  const api = useApiClient();

  const apiRef = useRef(api);
  apiRef.current = api;
  const tRef = useRef(t);
  tRef.current = t;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchInvoice = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiRef.current.get(
        `/api/v1/finance/invoices/${id}`
      );
      if (response.error) throw new Error(response.error);
      setInvoice(response.data as Invoice);
    } catch {
      setError(tRef.current("errorLoadingInvoice"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchPayments = useCallback(async () => {
    try {
      const response = await apiRef.current.get(
        `/api/v1/finance/payments?invoiceId=${id}`
      );
      if (response.error) throw new Error(response.error);
      setPayments(response.data as Payment[]);
    } catch {
      // Payments are non-critical, silently fail
    }
  }, [id]);

  useEffect(() => {
    if (!canReadFinance) {
      router.replace("/finance");
      return;
    }
    fetchInvoice();
    fetchPayments();
  }, [canReadFinance, router, fetchInvoice, fetchPayments]);

  const handleSend = useCallback(async () => {
    try {
      setActionLoading(true);
      await apiRef.current.post(`/api/v1/finance/invoices/${id}/send`, {});
      await fetchInvoice();
    } catch {
      setError(tRef.current("errorSendingInvoice"));
    } finally {
      setActionLoading(false);
    }
  }, [id, fetchInvoice]);

  const handleCancel = useCallback(async () => {
    try {
      setActionLoading(true);
      await apiRef.current.post(`/api/v1/finance/invoices/${id}/cancel`, {});
      await fetchInvoice();
    } catch {
      setError(tRef.current("errorCancellingInvoice"));
    } finally {
      setActionLoading(false);
    }
  }, [id, fetchInvoice]);

  const handleGenerateDunning = useCallback(async () => {
    try {
      setActionLoading(true);
      await apiRef.current.post(`/api/v1/finance/dunning`, {
        invoiceId: id,
      });
      await fetchInvoice();
    } catch {
      setError(tRef.current("errorGeneratingDunning"));
    } finally {
      setActionLoading(false);
    }
  }, [id, fetchInvoice]);

  if (!canReadFinance) return null;

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
      </div>
    );
  }

  if (error && !invoice) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          {error}
        </div>
      </div>
    );
  }

  if (!invoice) return null;

  return (
    <div className="space-y-6 p-6">
      {/* Error Banner */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          {error}
        </div>
      )}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/finance" className="hover:text-orange-600">
          {t("finance")}
        </Link>
        <span>/</span>
        <Link href="/finance/invoices" className="hover:text-orange-600">
          {t("invoices")}
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">
          {invoice.invoiceNumber}
        </span>
      </nav>

      {/* Invoice Header Card */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {invoice.invoiceNumber}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <span>
                {t("date")}:{" "}
                {new Date(invoice.date).toLocaleDateString("de-CH")}
              </span>
              <span>
                {t("dueDate")}:{" "}
                {new Date(invoice.dueDate).toLocaleDateString("de-CH")}
              </span>
            </div>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${statusColors[invoice.status] ?? "bg-gray-100 text-gray-800"}`}
          >
            {t(`status${invoice.status}`, { defaultValue: invoice.status })}
          </span>
        </div>
      </div>

      {/* Recipient Section */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">
          {t("recipient")}
        </h2>
        <div className="space-y-1 text-sm text-gray-700">
          <p className="font-medium">{invoice.recipientName}</p>
          {invoice.recipientAddress && (
            <p className="whitespace-pre-line">{invoice.recipientAddress}</p>
          )}
          <p className="text-gray-500">
            {t("recipientType")}:{" "}
            {t(`recipientType${invoice.recipientType}`, {
              defaultValue: invoice.recipientType,
            })}
          </p>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          {t("lineItems")}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="pb-3 font-medium">{t("description")}</th>
                <th className="pb-3 text-right font-medium">{t("quantity")}</th>
                <th className="pb-3 text-right font-medium">
                  {t("unitPrice")}
                </th>
                <th className="pb-3 text-right font-medium">{t("amount")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-3 text-gray-900">{item.description}</td>
                  <td className="py-3 text-right text-gray-700">
                    {item.quantity}
                  </td>
                  <td className="py-3 text-right text-gray-700">
                    {formatCHF(item.unitPrice)}
                  </td>
                  <td className="py-3 text-right font-medium text-gray-900">
                    {formatCHF(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mt-6 flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>{t("subTotal")}</span>
              <span>{formatCHF(invoice.subTotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>
                {t("taxRate")} ({invoice.taxRate}%)
              </span>
              <span>{formatCHF(invoice.taxAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-2 font-bold text-gray-900">
              <span>{t("total")}</span>
              <span>{formatCHF(invoice.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {canWriteFinance && (
        <div className="flex flex-wrap gap-3">
          {invoice.status === "Draft" && (
            <button
              onClick={handleSend}
              disabled={actionLoading}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {actionLoading ? t("sending") : t("send")}
            </button>
          )}
          <Link
            href={`/finance/payments?invoiceId=${invoice.id}`}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t("recordPayment")}
          </Link>
          {(invoice.status === "Overdue" || invoice.status === "Sent") && (
            <button
              onClick={handleGenerateDunning}
              disabled={actionLoading}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {actionLoading ? t("generating") : t("generateDunning")}
            </button>
          )}
          {invoice.status !== "Paid" && invoice.status !== "Cancelled" && (
            <button
              onClick={handleCancel}
              disabled={actionLoading}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {actionLoading ? t("cancelling") : t("cancel")}
            </button>
          )}
        </div>
      )}

      {/* Payment History */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          {t("paymentHistory")}
        </h2>
        {payments.length === 0 ? (
          <p className="text-sm text-gray-500">{t("noPayments")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-3 font-medium">{t("date")}</th>
                  <th className="pb-3 text-right font-medium">{t("amount")}</th>
                  <th className="pb-3 font-medium">{t("method")}</th>
                  <th className="pb-3 font-medium">{t("reference")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="py-3 text-gray-900">
                      {new Date(payment.date).toLocaleDateString("de-CH")}
                    </td>
                    <td className="py-3 text-right font-medium text-gray-900">
                      {formatCHF(payment.amount)}
                    </td>
                    <td className="py-3 text-gray-700">{payment.method}</td>
                    <td className="py-3 text-gray-700">{payment.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
