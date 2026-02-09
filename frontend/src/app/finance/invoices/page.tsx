"use client";

/**
 * Finance Invoices List Page
 * REQ-040: Rechnungserstellung
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth, useApiClient } from "@/lib/auth";

// --- Types ---

interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  recipientName: string;
  recipientType: "Member" | "External";
  subTotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  status: "Draft" | "Sent" | "Paid" | "Overdue" | "Cancelled";
}

type StatusFilter = "" | "Draft" | "Sent" | "Paid" | "Overdue" | "Cancelled";

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

const EyeIcon = ({ className }: { className?: string }) => (
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
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
    />
  </svg>
);

const SendIcon = ({ className }: { className?: string }) => (
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
      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
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

// --- Helpers ---

const formatCHF = (amount: number) =>
  new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(
    amount
  );

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("de-CH");
};

const statusBadgeClasses: Record<Invoice["status"], string> = {
  Draft: "bg-gray-100 text-gray-700",
  Sent: "bg-blue-100 text-blue-700",
  Paid: "bg-green-100 text-green-700",
  Overdue: "bg-red-100 text-red-700",
  Cancelled: "bg-gray-100 text-gray-400 line-through",
};

// --- Component ---

export default function InvoicesPage() {
  const t = useTranslations("finance");
  const router = useRouter();
  const {
    isAuthenticated,
    isLoading: authLoading,
    canReadFinance,
    canWriteFinance,
  } = useAuth();
  const api = useApiClient();

  // Stable refs for callbacks to avoid infinite loops
  const apiRef = useRef(api);
  apiRef.current = api;
  const tRef = useRef(t);
  tRef.current = t;

  // --- State ---

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // Confirmations
  const [confirmSendId, setConfirmSendId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  // --- Auth check ---

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !canReadFinance)) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, canReadFinance, router]);

  // --- Data fetching ---

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filterStatus) params.append("status", filterStatus);
      if (filterFrom) params.append("from", filterFrom);
      if (filterTo) params.append("to", filterTo);

      const query = params.toString();
      const url = `/api/v1/finance/invoices${query ? `?${query}` : ""}`;
      const res = await apiRef.current.get<Invoice[]>(url);

      if (res.error) {
        setError(res.error);
      } else if (res.data) {
        setInvoices(res.data as Invoice[]);
      }
    } catch {
      setError("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterFrom, filterTo]);

  useEffect(() => {
    if (isAuthenticated && canReadFinance) {
      fetchInvoices();
    }
  }, [isAuthenticated, canReadFinance, fetchInvoices]);

  // --- Actions ---

  const handleSend = useCallback(async (id: string) => {
    setActionLoading(id);
    setError(null);

    try {
      const res = await apiRef.current.post(
        `/api/v1/finance/invoices/${id}/send`,
        {}
      );
      if (res.error) {
        setError(res.error);
      } else {
        setInvoices((prev) =>
          prev.map((inv) =>
            inv.id === id ? { ...inv, status: "Sent" as const } : inv
          )
        );
      }
    } catch {
      setError("Failed to send invoice");
    } finally {
      setActionLoading(null);
      setConfirmSendId(null);
    }
  }, []);

  const handleCancel = useCallback(async (id: string) => {
    setActionLoading(id);
    setError(null);

    try {
      const res = await apiRef.current.delete(`/api/v1/finance/invoices/${id}`);
      if (res.error) {
        setError(res.error);
      } else {
        setInvoices((prev) =>
          prev.map((inv) =>
            inv.id === id ? { ...inv, status: "Cancelled" as const } : inv
          )
        );
      }
    } catch {
      setError("Failed to cancel invoice");
    } finally {
      setActionLoading(null);
      setConfirmCancelId(null);
    }
  }, []);

  // --- Status label ---

  const statusLabel = useCallback((status: Invoice["status"]) => {
    const map: Record<Invoice["status"], string> = {
      Draft: tRef.current("draft"),
      Sent: tRef.current("sent"),
      Paid: tRef.current("paid"),
      Overdue: tRef.current("overdue"),
      Cancelled: tRef.current("cancelled"),
    };
    return map[status];
  }, []);

  // --- Render guards ---

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-t-2 border-b-2 border-orange-600" />
      </div>
    );
  }

  if (!isAuthenticated || !canReadFinance) {
    return null;
  }

  // --- Render ---

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("invoices")}</h1>
        {canWriteFinance && (
          <Link
            href="/finance/invoices/new"
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700"
          >
            <PlusIcon className="h-4 w-4" />
            {t("newInvoice")}
          </Link>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          {/* Status filter */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t("filterByStatus")}
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
            >
              <option value="">{t("allStatuses")}</option>
              <option value="Draft">{t("draft")}</option>
              <option value="Sent">{t("sent")}</option>
              <option value="Paid">{t("paid")}</option>
              <option value="Overdue">{t("overdue")}</option>
              <option value="Cancelled">{t("cancelled")}</option>
            </select>
          </div>

          {/* Date from */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t("from")}
            </label>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
            />
          </div>

          {/* Date to */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t("to")}
            </label>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
            />
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-orange-600" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            {t("noInvoices")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
                  <th className="pr-4 pb-3 font-medium">
                    {t("invoiceNumber")}
                  </th>
                  <th className="pr-4 pb-3 font-medium">{t("date")}</th>
                  <th className="pr-4 pb-3 font-medium">
                    {t("recipientName")}
                  </th>
                  <th className="pr-4 pb-3 font-medium">{t("dueDate")}</th>
                  <th className="pr-4 pb-3 text-right font-medium">
                    {t("total")}
                  </th>
                  <th className="pr-4 pb-3 font-medium">{t("status")}</th>
                  <th className="pb-3 font-medium">{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-3 pr-4 font-medium text-gray-900">
                      {invoice.invoiceNumber}
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      {formatDate(invoice.date)}
                    </td>
                    <td className="py-3 pr-4 text-gray-900">
                      {invoice.recipientName}
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      {formatDate(invoice.dueDate)}
                    </td>
                    <td className="py-3 pr-4 text-right font-medium text-gray-900">
                      {formatCHF(invoice.total)}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClasses[invoice.status]}`}
                      >
                        {statusLabel(invoice.status)}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {/* View */}
                        <Link
                          href={`/finance/invoices/${invoice.id}`}
                          className="text-gray-500 transition-colors hover:text-orange-600"
                          title={t("view")}
                        >
                          <EyeIcon className="h-4 w-4" />
                        </Link>

                        {/* Send (only Draft) */}
                        {canWriteFinance && invoice.status === "Draft" && (
                          <button
                            onClick={() => setConfirmSendId(invoice.id)}
                            disabled={actionLoading === invoice.id}
                            className="text-blue-500 transition-colors hover:text-blue-700 disabled:opacity-50"
                            title={t("send")}
                          >
                            <SendIcon className="h-4 w-4" />
                          </button>
                        )}

                        {/* Cancel (not Cancelled or Paid) */}
                        {canWriteFinance &&
                          invoice.status !== "Cancelled" &&
                          invoice.status !== "Paid" && (
                            <button
                              onClick={() => setConfirmCancelId(invoice.id)}
                              disabled={actionLoading === invoice.id}
                              className="text-red-500 transition-colors hover:text-red-700 disabled:opacity-50"
                              title={t("cancelled")}
                            >
                              <XIcon className="h-4 w-4" />
                            </button>
                          )}

                        {/* Loading indicator for actions */}
                        {actionLoading === invoice.id && (
                          <div className="h-4 w-4 animate-spin rounded-full border-t-2 border-b-2 border-orange-600" />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Send Confirmation Modal */}
      {confirmSendId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900">
              {t("confirmSend")}
            </h3>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmSendId(null)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-200"
              >
                {t("cancelled")}
              </button>
              <button
                onClick={() => handleSend(confirmSendId)}
                disabled={actionLoading === confirmSendId}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
              >
                {t("send")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {confirmCancelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900">
              {t("confirmCancel")}
            </h3>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmCancelId(null)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-200"
              >
                {t("cancelled")}
              </button>
              <button
                onClick={() => handleCancel(confirmCancelId)}
                disabled={actionLoading === confirmCancelId}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {t("confirmCancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
