"use client";

/**
 * Invoices LIST content (E26-S3 migration of `app/finance/invoices/page.tsx`).
 * Composition root (only `"use client"`) — self-embeds its own `QueryClientProvider`.
 *
 * Canonical read guard (isAuthenticated + authLoading; spinner while authLoading; redirect
 * `router.push("/")`; `if (!isAuthenticated||!canReadFinance) return null`). Client search +
 * SERVER status/date filters (`?status=&from=&to=`). A100: Send→"Sent" / Cancel→"Cancelled"
 * are optimistic LOCAL status patches with NO refetch — kept as a `statusOverrides` overlay
 * keyed on the active filter (reset on filter change, NOT on data identity) and left
 * UNCHANGED on error. Endpoint divergence: list Cancel = DELETE /invoices/{id} (vs the detail
 * page's POST /cancel). Affordances (A86): send = blue icon + orange confirm; cancel = red
 * icon + red confirm; both via a two-step modal.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { formatCHF } from "@/lib/utils";
import {
  useCancelInvoiceFromList,
  useInvoices,
  useSendInvoice,
} from "../../hooks/use-invoices";
import type {
  InvoiceListRow,
  InvoiceStatus,
  InvoiceStatusFilter,
} from "../../types/receivables.types";

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

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("de-CH");

const statusBadgeClasses: Record<InvoiceStatus, string> = {
  Draft: "bg-gray-100 text-gray-700",
  Sent: "bg-blue-100 text-blue-700",
  Paid: "bg-green-100 text-green-700",
  Overdue: "bg-red-100 text-red-700",
  Cancelled: "bg-gray-100 text-gray-400 line-through",
};

function InvoicesBody() {
  const t = useTranslations("finance");
  const router = useRouter();
  const {
    isAuthenticated,
    isLoading: authLoading,
    canReadFinance,
    canWriteFinance,
  } = useAuth();

  // Filters (status/date are server-side; search is client-side).
  const [filterStatus, setFilterStatus] = useState<InvoiceStatusFilter>("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmSendId, setConfirmSendId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  // A100: optimistic LOCAL status overlay keyed on the active filter. Reset whenever the
  // server filter changes (NOT on data identity) so a refetched same-key list keeps the
  // patch; a filter change starts a fresh overlay. Send→"Sent", Cancel→"Cancelled".
  const filterKey = `${filterStatus}|${filterFrom}|${filterTo}`;
  const [overlay, setOverlay] = useState<{
    key: string;
    map: Record<string, InvoiceStatus>;
  }>({ key: filterKey, map: {} });
  const statusOverrides = overlay.key === filterKey ? overlay.map : {};

  const enabled = isAuthenticated && canReadFinance;
  const invoicesQuery = useInvoices(
    filterStatus,
    filterFrom,
    filterTo,
    enabled
  );
  const loading = enabled && invoicesQuery.isLoading;
  const rawInvoices = useMemo(
    () => invoicesQuery.data ?? [],
    [invoicesQuery.data]
  );

  const sendMutation = useSendInvoice();
  const cancelMutation = useCancelInvoiceFromList();

  const banner =
    error ??
    (invoicesQuery.isError ? (invoicesQuery.error?.message ?? null) : null);

  // Canonical guard.
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !canReadFinance)) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, canReadFinance, router]);

  const patchStatus = (id: string, status: InvoiceStatus) => {
    setOverlay((prev) => {
      const base = prev.key === filterKey ? prev.map : {};
      return { key: filterKey, map: { ...base, [id]: status } };
    });
  };

  const handleSend = (id: string) => {
    setActionLoading(id);
    setError(null);
    sendMutation.mutate(id, {
      onSuccess: () => patchStatus(id, "Sent"),
      onError: (e) => setError(e.message),
      onSettled: () => {
        setActionLoading(null);
        setConfirmSendId(null);
      },
    });
  };

  const handleCancel = (id: string) => {
    setActionLoading(id);
    setError(null);
    cancelMutation.mutate(id, {
      onSuccess: () => patchStatus(id, "Cancelled"),
      onError: (e) => setError(e.message),
      onSettled: () => {
        setActionLoading(null);
        setConfirmCancelId(null);
      },
    });
  };

  const statusLabel = (status: InvoiceStatus) => {
    const map: Record<InvoiceStatus, string> = {
      Draft: t("draft"),
      Sent: t("sent"),
      Paid: t("paid"),
      Overdue: t("overdue"),
      Cancelled: t("cancelled"),
    };
    return map[status];
  };

  // Apply the optimistic overlay over the server rows.
  const invoices: InvoiceListRow[] = rawInvoices.map((inv) =>
    statusOverrides[inv.id] ? { ...inv, status: statusOverrides[inv.id] } : inv
  );

  const filteredInvoices = invoices.filter((inv) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(term) ||
      inv.recipientName.toLowerCase().includes(term) ||
      formatCHF(inv.total).toLowerCase().includes(term) ||
      inv.status.toLowerCase().includes(term)
    );
  });

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
      {banner && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          <span>{banner}</span>
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
          <div className="relative flex-1">
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
              placeholder={t("invoicesSearchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-10 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t("filterByStatus")}
            </label>
            <select
              value={filterStatus}
              onChange={(e) =>
                setFilterStatus(e.target.value as InvoiceStatusFilter)
              }
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
        ) : filteredInvoices.length === 0 ? (
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
                {filteredInvoices.map((invoice) => (
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
                        <Link
                          href={`/finance/invoices/${invoice.id}`}
                          className="text-gray-500 transition-colors hover:text-orange-600"
                          title={t("view")}
                        >
                          <EyeIcon className="h-4 w-4" />
                        </Link>

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

export function InvoicesPageContent() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <InvoicesBody />
    </QueryClientProvider>
  );
}
