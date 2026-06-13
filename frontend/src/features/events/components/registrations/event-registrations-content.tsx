/**
 * REQ-021: Event Registrations Management composition root (E24-S3).
 *
 * The single `"use client"` boundary for `/events/[id]/registrations`, extracted
 * from the ~779-line god-page. Behaviour-preserving: auth/role gating (renders
 * null for a non-manager / unauthenticated user), the pageSize=20 load, status
 * filter + search BOTH resetting the page to 1, the 7 stat cards, the REQ-022
 * page-scoped payment summary, the per-status action buttons (Confirm / CheckIn
 * / MarkNoShow / Revert* / Cancel), PDF + CSV export, promoteFromWaitlist, the
 * `loadFailed` surface, and pagination are reproduced exactly.
 *
 * Transport adaptation (the ONLY change): every registration call now goes
 * through the events slice api (`event-registrations-api`, built on the same
 * `useApiClient` the exports already used) instead of `events`.
 * URLs/params/bodies are byte-identical (the service prefixed `/api/v1`; the
 * slice's `EVENTS_BASE` is `/api/v1/events`). The god-page's imperative
 * `loadData` (event + registrations + stats in one Promise.all, `loadFailed` if
 * ANY throws, reload-after-action) is preserved verbatim — only the called
 * functions changed.
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth, useApiClient } from "@/lib/auth";
import { PageShell } from "@/components/layout";
import { formatCurrency } from "@/lib/utils";
import { getEvent } from "../../api/events-api";
import {
  getEventRegistrations,
  getEventRegistrationStatistics,
  cancelEventRegistration,
  confirmEventRegistration,
  checkInRegistration,
  markRegistrationAsNoShow,
  revertRegistrationNoShow,
  revertRegistrationCheckIn,
  revertRegistrationCancellation,
  promoteFromWaitlist,
  registrationsExportPdfUrl,
  registrationsExportCsvUrl,
} from "../../api/event-registrations-api";
import type {
  EventDto,
  EventRegistrationDto,
  EventRegistrationStatistics,
  RegistrationStatus,
} from "../../types/events.types";

const statusColors: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-800",
  Confirmed: "bg-green-100 text-green-800",
  Cancelled: "bg-red-100 text-red-800",
  Waitlisted: "bg-blue-100 text-blue-800",
  CheckedIn: "bg-emerald-100 text-emerald-800",
  NoShow: "bg-gray-100 text-gray-800",
};

// REQ-022 (E4-S3): payment-status pill colors, derived from the linked invoice (E4-S2).
const paymentStatusColors: Record<string, string> = {
  Paid: "bg-emerald-100 text-emerald-800",
  Pending: "bg-amber-100 text-amber-800",
  None: "bg-gray-100 text-gray-500",
};

interface EventRegistrationsContentProps {
  id: string;
}

export function EventRegistrationsContent({
  id: eventId,
}: EventRegistrationsContentProps) {
  const t = useTranslations("events");
  const tCommon = useTranslations("common");
  const {
    isAuthenticated,
    isLoading: authLoading,
    isVorstand,
    isAdmin,
  } = useAuth();
  const router = useRouter();

  const canManage = isVorstand || isAdmin;
  const api = useApiClient();

  const [event, setEvent] = useState<EventDto | null>(null);
  const [registrations, setRegistrations] = useState<EventRegistrationDto[]>(
    []
  );
  const [stats, setStats] = useState<EventRegistrationStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [csvExportLoading, setCsvExportLoading] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<RegistrationStatus | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventResult, regResult, statsResult] = await Promise.all([
        getEvent(api, eventId),
        getEventRegistrations(api, eventId, {
          status: statusFilter || undefined,
          searchTerm: search || undefined,
          page,
          pageSize,
        }),
        getEventRegistrationStatistics(api, eventId),
      ]);
      if (eventResult.data) setEvent(eventResult.data);
      if (regResult.data) {
        setRegistrations(regResult.data.items);
        setTotalPages(regResult.data.totalPages);
      }
      if (statsResult.data) setStats(statsResult.data);
    } catch {
      setError(t("registration.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [api, eventId, statusFilter, search, page, pageSize, t]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }
    if (!authLoading && isAuthenticated) {
      loadData();
    }
  }, [authLoading, isAuthenticated, router, loadData]);

  const handleAction = async (
    registrationId: string,
    action:
      | "cancel"
      | "confirm"
      | "checkIn"
      | "noShow"
      | "revertNoShow"
      | "revertCheckIn"
      | "revertCancellation"
  ) => {
    setActionLoading(registrationId);
    try {
      let result;
      switch (action) {
        case "cancel":
          result = await cancelEventRegistration(api, eventId, registrationId);
          break;
        case "confirm":
          result = await confirmEventRegistration(api, eventId, registrationId);
          break;
        case "checkIn":
          result = await checkInRegistration(api, eventId, registrationId);
          break;
        case "noShow":
          result = await markRegistrationAsNoShow(api, eventId, registrationId);
          break;
        case "revertNoShow":
          result = await revertRegistrationNoShow(api, eventId, registrationId);
          break;
        case "revertCheckIn":
          result = await revertRegistrationCheckIn(
            api,
            eventId,
            registrationId
          );
          break;
        case "revertCancellation":
          result = await revertRegistrationCancellation(
            api,
            eventId,
            registrationId
          );
          break;
      }
      if (result?.data) {
        await loadData();
      }
    } catch {
      setError(t("registration.loadFailed"));
    } finally {
      setActionLoading(null);
    }
  };

  const handlePromote = async () => {
    setActionLoading("promote");
    try {
      const result = await promoteFromWaitlist(api, eventId);
      if (result.data) {
        await loadData();
      } else {
        setError(t("registration.promoteFailed"));
      }
    } catch {
      setError(t("registration.promoteFailed"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadLoading(true);
    setError(null);
    try {
      const res = await api.get<Blob>(registrationsExportPdfUrl(eventId));
      if (res.error) throw new Error(res.error);
      if (res.data && res.data instanceof Blob) {
        const url = URL.createObjectURL(res.data);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Anmeldeliste_${event?.title ?? eventId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {
      setError(t("registration.downloadFailed"));
    } finally {
      setDownloadLoading(false);
    }
  };

  const handleExportCsv = async () => {
    setCsvExportLoading(true);
    setError(null);
    try {
      const res = await api.get<Blob>(registrationsExportCsvUrl(eventId));
      if (res.error) throw new Error(res.error);
      if (res.data && res.data instanceof Blob) {
        const url = URL.createObjectURL(res.data);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Anmeldungen_${event?.title ?? eventId}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {
      setError(t("registration.downloadFailed"));
    } finally {
      setCsvExportLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <PageShell>
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-gray-200" />
          <div className="h-12 rounded-xl bg-gray-200" />
          <div className="h-96 rounded-xl bg-gray-200" />
        </div>
      </PageShell>
    );
  }

  if (!isAuthenticated || !canManage) return null;

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      Pending: t("registration.pending"),
      Confirmed: t("registration.confirmed"),
      Cancelled: t("registration.cancelledShort"),
      Waitlisted: t("registration.waitlisted"),
      CheckedIn: t("registration.checkedIn"),
      NoShow: t("registration.noShow"),
    };
    return map[status] || status;
  };

  // REQ-022 (E4-S3): payment-status label + page-scoped payment summary (payment data is only
  // present on the loaded page of registrations).
  const paymentLabel = (status?: string) => {
    const map: Record<string, string> = {
      Paid: t("registration.paymentPaid"),
      Pending: t("registration.paymentPending"),
      None: "—",
    };
    return map[status ?? "None"] || "—";
  };

  const paymentSummary = registrations.reduce(
    (acc, r) => {
      if (r.paymentStatus === "Paid") {
        acc.paidCount += 1;
        acc.paidAmount += r.amountDue ?? 0;
      } else if (r.paymentStatus === "Pending") {
        acc.pendingCount += 1;
        acc.pendingAmount += r.amountDue ?? 0;
      }
      if (r.currency && !acc.currency) acc.currency = r.currency;
      return acc;
    },
    {
      paidCount: 0,
      pendingCount: 0,
      paidAmount: 0,
      pendingAmount: 0,
      currency: "CHF",
    }
  );
  const hasPayments =
    paymentSummary.paidCount + paymentSummary.pendingCount > 0;

  return (
    <PageShell>
      {/* Back Link */}
      <Link
        href={`/events/${eventId}`}
        className="mb-6 inline-flex items-center gap-2 text-gray-600 transition-colors hover:text-orange-600"
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
            d="M10 19l-7-7m0 0l7-7m-7 7h18"
          />
        </svg>
        {t("registration.backToEvent")}
      </Link>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("registration.allRegistrations")}
          </h1>
          {event && (
            <p className="mt-1 text-gray-500">
              {t("registration.registrationsFor", {
                eventTitle: event.title,
              })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPdf}
            disabled={downloadLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            {downloadLoading
              ? tCommon("loading")
              : t("registration.downloadPdf")}
          </button>
          <button
            onClick={handleExportCsv}
            disabled={csvExportLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            {csvExportLoading
              ? tCommon("loading")
              : t("registration.exportCsv")}
          </button>
          {stats && stats.waitlistedCount > 0 && (
            <button
              onClick={handlePromote}
              disabled={actionLoading === "promote"}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 10l7-7m0 0l7 7m-7-7v18"
                />
              </svg>
              {actionLoading === "promote"
                ? tCommon("loading")
                : t("registration.promoteNext")}
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-xl font-bold text-red-700 hover:text-red-900"
          >
            ×
          </button>
        </div>
      )}

      {/* Statistics */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <div className="rounded-lg bg-white p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-gray-900">
              {stats.totalRegistrations}
            </p>
            <p className="text-xs text-gray-500">{t("registration.total")}</p>
          </div>
          <div className="rounded-lg bg-white p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-green-700">
              {stats.confirmedCount}
            </p>
            <p className="text-xs text-green-600">
              {t("registration.confirmed")}
            </p>
          </div>
          <div className="rounded-lg bg-white p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-yellow-700">
              {stats.pendingCount}
            </p>
            <p className="text-xs text-yellow-600">
              {t("registration.pending")}
            </p>
          </div>
          <div className="rounded-lg bg-white p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-blue-700">
              {stats.waitlistedCount}
            </p>
            <p className="text-xs text-blue-600">
              {t("registration.waitlisted")}
            </p>
          </div>
          <div className="rounded-lg bg-white p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-emerald-700">
              {stats.checkedInCount}
            </p>
            <p className="text-xs text-emerald-600">
              {t("registration.checkedIn")}
            </p>
          </div>
          <div className="rounded-lg bg-white p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-red-700">
              {stats.cancelledCount}
            </p>
            <p className="text-xs text-red-600">
              {t("registration.cancelledShort")}
            </p>
          </div>
          <div className="rounded-lg bg-white p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-gray-700">
              {stats.noShowCount}
            </p>
            <p className="text-xs text-gray-500">{t("registration.noShow")}</p>
          </div>
        </div>
      )}

      {/* REQ-022 (E4-S3): payment summary (this page) */}
      {hasPayments && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-white p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-emerald-700">
              {paymentSummary.paidCount}
            </p>
            <p className="text-xs text-emerald-600">
              {t("registration.paymentPaid")}
            </p>
          </div>
          <div className="rounded-lg bg-white p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-amber-700">
              {paymentSummary.pendingCount}
            </p>
            <p className="text-xs text-amber-600">
              {t("registration.paymentPending")}
            </p>
          </div>
          <div className="rounded-lg bg-white p-3 text-center shadow-sm">
            <p className="text-lg font-bold text-emerald-700">
              {formatCurrency(
                paymentSummary.paidAmount,
                paymentSummary.currency
              )}
            </p>
            <p className="text-xs text-emerald-600">
              {t("registration.amountPaid")}
            </p>
          </div>
          <div className="rounded-lg bg-white p-3 text-center shadow-sm">
            <p className="text-lg font-bold text-amber-700">
              {formatCurrency(
                paymentSummary.pendingAmount,
                paymentSummary.currency
              )}
            </p>
            <p className="text-xs text-amber-600">
              {t("registration.amountOwed")}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm sm:flex-row">
        <div className="flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t("registration.searchParticipant")}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as RegistrationStatus | "");
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
        >
          <option value="">{t("registration.allStatuses")}</option>
          <option value="Pending">{t("registration.pending")}</option>
          <option value="Confirmed">{t("registration.confirmed")}</option>
          <option value="Waitlisted">{t("registration.waitlisted")}</option>
          <option value="CheckedIn">{t("registration.checkedIn")}</option>
          <option value="Cancelled">{t("registration.cancelledShort")}</option>
          <option value="NoShow">{t("registration.noShow")}</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        {registrations.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            {t("registration.noRegistrations")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    {t("registration.participant")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    {t("registration.email")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    {t("registration.phone")}
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">
                    {t("registration.guests")}
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">
                    {t("registration.status")}
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">
                    {t("registration.payment")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    {t("registration.registeredAt")}
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">
                    {t("registration.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((reg) => (
                  <tr
                    key={reg.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {reg.participantName}
                      </div>
                      {reg.isWaitlisted && reg.waitlistPosition && (
                        <span className="text-xs text-blue-600">
                          #{reg.waitlistPosition}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {reg.participantEmail}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {reg.participantPhone || "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {reg.numberOfGuests}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusColors[reg.status] || "bg-gray-100 text-gray-800"}`}
                      >
                        {statusLabel(reg.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {reg.paymentStatus && reg.paymentStatus !== "None" ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${paymentStatusColors[reg.paymentStatus] || "bg-gray-100 text-gray-500"}`}
                          >
                            {paymentLabel(reg.paymentStatus)}
                          </span>
                          {reg.amountDue != null && (
                            <span className="text-xs text-gray-500">
                              {formatCurrency(
                                reg.amountDue,
                                reg.currency ?? "CHF"
                              )}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(reg.registeredAt).toLocaleDateString("de-CH", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {reg.status === "Pending" && (
                          <button
                            onClick={() => handleAction(reg.id, "confirm")}
                            disabled={actionLoading === reg.id}
                            className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-200 disabled:opacity-50"
                            title={t("registration.confirm")}
                          >
                            {t("registration.confirm")}
                          </button>
                        )}
                        {reg.status === "Confirmed" && (
                          <>
                            <button
                              onClick={() => handleAction(reg.id, "checkIn")}
                              disabled={actionLoading === reg.id}
                              className="rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-200 disabled:opacity-50"
                              title={t("registration.checkIn")}
                            >
                              {t("registration.checkIn")}
                            </button>
                            <button
                              onClick={() => handleAction(reg.id, "noShow")}
                              disabled={actionLoading === reg.id}
                              className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                              title={t("registration.markNoShow")}
                            >
                              {t("registration.markNoShow")}
                            </button>
                          </>
                        )}
                        {reg.status === "NoShow" && (
                          <button
                            onClick={() => handleAction(reg.id, "revertNoShow")}
                            disabled={actionLoading === reg.id}
                            className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200 disabled:opacity-50"
                            title={t("registration.revertNoShow")}
                          >
                            {t("registration.revertNoShow")}
                          </button>
                        )}
                        {reg.status === "CheckedIn" && (
                          <button
                            onClick={() =>
                              handleAction(reg.id, "revertCheckIn")
                            }
                            disabled={actionLoading === reg.id}
                            className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200 disabled:opacity-50"
                            title={t("registration.revertCheckIn")}
                          >
                            {t("registration.revertCheckIn")}
                          </button>
                        )}
                        {reg.status === "Cancelled" && (
                          <button
                            onClick={() =>
                              handleAction(reg.id, "revertCancellation")
                            }
                            disabled={actionLoading === reg.id}
                            className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200 disabled:opacity-50"
                            title={t("registration.revertCancellation")}
                          >
                            {t("registration.revertCancellation")}
                          </button>
                        )}
                        {(reg.status === "Pending" ||
                          reg.status === "Confirmed" ||
                          reg.status === "Waitlisted") && (
                          <button
                            onClick={() => handleAction(reg.id, "cancel")}
                            disabled={actionLoading === reg.id}
                            className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
                            title={t("registration.cancel")}
                          >
                            {t("registration.cancel")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {t("registration.previous")}
            </button>
            <span className="text-sm text-gray-500">
              {t("registration.page", { current: page, total: totalPages })}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {t("registration.next")}
            </button>
          </div>
        )}
      </div>
    </PageShell>
  );
}
