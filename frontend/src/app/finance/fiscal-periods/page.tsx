"use client";

/**
 * Fiscal Periods Page
 * REQ-066: Fiscal Period Closing & Locking
 */

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth, useApiClient } from "@/lib/auth";
import type { FiscalPeriod } from "@/types/finance";

// --- Icons ---

const HomeIcon = ({ className }: { className?: string }) => (
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
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z"
    />
  </svg>
);

const ChevronRightIcon = ({ className }: { className?: string }) => (
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
      d="M9 5l7 7-7 7"
    />
  </svg>
);

const CalendarIcon = ({ className }: { className?: string }) => (
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
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const LockIcon = ({ className }: { className?: string }) => (
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
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
    />
  </svg>
);

const UnlockIcon = ({ className }: { className?: string }) => (
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
      d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
    />
  </svg>
);

const CheckCircleIcon = ({ className }: { className?: string }) => (
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
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const RefreshIcon = ({ className }: { className?: string }) => (
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
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);

// --- Status Badge ---

function StatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    Open: { bg: "bg-green-100", text: "text-green-800", label: t("statusOpen") },
    Closed: { bg: "bg-yellow-100", text: "text-yellow-800", label: t("statusClosed") },
    Locked: { bg: "bg-red-100", text: "text-red-800", label: t("statusLocked") },
  };
  const c = config[status] ?? config.Open;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

// --- Confirmation Modal ---

function ConfirmModal({
  open,
  title,
  message,
  showNotes,
  notesLabel,
  notesPlaceholder,
  notes,
  onNotesChange,
  onConfirm,
  onCancel,
  loading,
  tc,
}: {
  open: boolean;
  title: string;
  message: string;
  showNotes?: boolean;
  notesLabel?: string;
  notesPlaceholder?: string;
  notes?: string;
  onNotesChange?: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  tc: (key: string) => string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        {showNotes && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">
              {notesLabel}
            </label>
            <textarea
              className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none"
              rows={3}
              placeholder={notesPlaceholder}
              value={notes ?? ""}
              onChange={(e) => onNotesChange?.(e.target.value)}
            />
          </div>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            {tc("cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
          >
            {loading ? tc("loading") : tc("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Format helpers ---

const formatCHF = (amount: number | null) =>
  amount != null
    ? new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(amount)
    : "—";

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

// --- Main Page ---

export default function FiscalPeriodsPage() {
  const t = useTranslations("fiscalPeriods");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  const tfe = useTranslations("financeErrors");
  const { canReadFinance, canWriteFinance, isAdmin, isLoading: authLoading } = useAuth();
  const api = useApiClient();

  const apiRef = useRef(api);
  apiRef.current = api;

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noProfileError, setNoProfileError] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal state
  const [modalType, setModalType] = useState<"lock" | "unlock" | "close" | "reopen" | null>(null);
  const [modalPeriod, setModalPeriod] = useState<FiscalPeriod | null>(null);
  const [modalNotes, setModalNotes] = useState("");
  const [modalLoading, setModalLoading] = useState(false);

  // Load periods
  const loadPeriods = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiRef.current.get<FiscalPeriod[]>(
        `/api/v1/finance/fiscal-periods?year=${selectedYear}`
      );
      if (response.error) {
        setError(t("error"));
        return;
      }
      const body = response.data as unknown as { items: FiscalPeriod[] };
      setPeriods(body?.items ?? []);
    } catch {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  }, [selectedYear, t]);

  useEffect(() => {
    if (!authLoading && canReadFinance) {
      loadPeriods();
    }
  }, [authLoading, canReadFinance, loadPeriods]);

  // Generate periods
  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setNoProfileError(false);
    setSuccess(null);
    try {
      const response = await apiRef.current.post<FiscalPeriod[]>(
        "/api/v1/finance/fiscal-periods/generate",
        { year: selectedYear }
      );
      if (response.error) {
        if (response.status === 409 && response.error.toLowerCase().includes("finance profile")) {
          setNoProfileError(true);
        } else {
          setError(response.error);
        }
        return;
      }
      setPeriods(response.data ?? []);
      setSuccess(t("generateSuccess"));
    } catch {
      setError(t("error"));
    } finally {
      setGenerating(false);
    }
  };

  // Close period
  const handleClose = async () => {
    if (!modalPeriod) return;
    setModalLoading(true);
    try {
      const response = await apiRef.current.post<FiscalPeriod>(
        `/api/v1/finance/fiscal-periods/${modalPeriod.id}/close`,
        { notes: modalNotes || null }
      );
      if (response.error) {
        setError(response.error);
      } else {
        setSuccess(t("closeSuccess"));
        await loadPeriods();
      }
    } catch {
      setError(t("error"));
    } finally {
      setModalLoading(false);
      setModalType(null);
      setModalPeriod(null);
      setModalNotes("");
    }
  };

  // Reopen period
  const handleReopen = async () => {
    if (!modalPeriod) return;
    setModalLoading(true);
    try {
      const response = await apiRef.current.post<FiscalPeriod>(
        `/api/v1/finance/fiscal-periods/${modalPeriod.id}/reopen`,
        {}
      );
      if (response.error) {
        setError(response.error);
      } else {
        setSuccess(t("reopenSuccess"));
        await loadPeriods();
      }
    } catch {
      setError(t("error"));
    } finally {
      setModalLoading(false);
      setModalType(null);
      setModalPeriod(null);
    }
  };

  // Lock period
  const handleLock = async () => {
    if (!modalPeriod) return;
    setModalLoading(true);
    try {
      const response = await apiRef.current.post<FiscalPeriod>(
        `/api/v1/finance/fiscal-periods/${modalPeriod.id}/lock`,
        { notes: modalNotes || null }
      );
      if (response.error) {
        setError(response.error);
      } else {
        setSuccess(t("lockSuccess"));
        await loadPeriods();
      }
    } catch {
      setError(t("error"));
    } finally {
      setModalLoading(false);
      setModalType(null);
      setModalPeriod(null);
      setModalNotes("");
    }
  };

  // Unlock period
  const handleUnlock = async () => {
    if (!modalPeriod) return;
    setModalLoading(true);
    try {
      const response = await apiRef.current.post<FiscalPeriod>(
        `/api/v1/finance/fiscal-periods/${modalPeriod.id}/unlock`,
        {}
      );
      if (response.error) {
        setError(response.error);
      } else {
        setSuccess(t("unlockSuccess"));
        await loadPeriods();
      }
    } catch {
      setError(t("error"));
    } finally {
      setModalLoading(false);
      setModalType(null);
      setModalPeriod(null);
    }
  };

  // Modal confirm handler
  const handleModalConfirm = () => {
    switch (modalType) {
      case "close":
        return handleClose();
      case "reopen":
        return handleReopen();
      case "lock":
        return handleLock();
      case "unlock":
        return handleUnlock();
      default:
        return;
    }
  };

  // Modal config per type
  const modalConfig = {
    close: {
      title: t("closeConfirmTitle"),
      message: t("closeConfirmMessage"),
      showNotes: true,
    },
    reopen: {
      title: t("reopenConfirmTitle"),
      message: t("reopenConfirmMessage"),
      showNotes: false,
    },
    lock: {
      title: t("lockConfirmTitle"),
      message: t("lockConfirmMessage"),
      showNotes: true,
    },
    unlock: {
      title: t("unlockConfirmTitle"),
      message: t("unlockConfirmMessage"),
      showNotes: false,
    },
  };

  // Auto-dismiss success message
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Year options
  const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 3 + i);

  // Auth guard
  if (authLoading) {
    return (
      <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
        <div className="max-w-7xl mx-auto flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
        </div>
      </main>
    );
  }

  if (!canReadFinance) {
    return (
      <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
        <div className="max-w-7xl mx-auto text-center py-20">
          <p className="text-gray-500">{tc("error")}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/" className="hover:text-gray-700">
            <HomeIcon className="h-4 w-4" />
          </Link>
          <ChevronRightIcon className="h-3 w-3" />
          <Link href="/finance" className="hover:text-gray-700">
            {tn("finance")}
          </Link>
          <ChevronRightIcon className="h-3 w-3" />
          <span className="text-gray-900 font-medium">{t("title")}</span>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                <CalendarIcon className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
                <p className="text-sm text-gray-500">{t("subtitle")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Year selector */}
              <div className="flex items-center gap-2">
                <label htmlFor="year-select" className="text-sm font-medium text-gray-700">
                  {t("year")}:
                </label>
                <select
                  id="year-select"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              {/* Generate button */}
              {canWriteFinance && (
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      {t("generating")}
                    </>
                  ) : (
                    <>
                      <CalendarIcon className="h-4 w-4" />
                      {t("generate")}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Success message */}
        {success && (
          <div className="mb-6 rounded-lg bg-green-50 border border-green-200 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-green-800">{success}</p>
              <button
                onClick={() => setSuccess(null)}
                className="text-green-600 hover:text-green-800"
              >
                <span className="sr-only">{tc("dismiss")}</span>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* No finance profile error */}
        {noProfileError && (
          <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-800">{tfe("noFinanceProfile")}</p>
                <Link
                  href="/finance/settings"
                  className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-orange-600 hover:text-orange-700 underline"
                >
                  {tfe("goToSettings")} →
                </Link>
              </div>
              <button
                onClick={() => setNoProfileError(false)}
                className="text-amber-600 hover:text-amber-800"
              >
                <span className="sr-only">{tc("dismiss")}</span>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-red-800">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800"
              >
                <span className="sr-only">{tc("dismiss")}</span>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
          </div>
        ) : periods.length === 0 ? (
          /* Empty state */
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <CalendarIcon className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">{t("noPeriodsTitle")}</h3>
            <p className="mt-2 text-sm text-gray-500">{t("noPeriodsMessage")}</p>
            {canWriteFinance && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
              >
                <CalendarIcon className="h-4 w-4" />
                {t("generate")}
              </button>
            )}
          </div>
        ) : (
          /* Periods table */
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      {t("period")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      {t("startDate")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      {t("endDate")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      {t("status")}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      {t("totalIncome")}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      {t("totalExpense")}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      {t("closingBalance")}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      {t("actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {periods.map((period) => (
                    <tr key={period.id} className="hover:bg-gray-50 transition-colors">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                        {period.name}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {formatDate(period.startDate)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {formatDate(period.endDate)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <StatusBadge status={period.status} t={t} />
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-right text-gray-500">
                        {period.status !== "Open" ? (
                          <span className="text-green-700 font-medium">
                            {formatCHF(period.totalIncome)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-right text-gray-500">
                        {period.status !== "Open" ? (
                          <span className="text-red-700 font-medium">
                            {formatCHF(period.totalExpense)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-right text-gray-500">
                        {period.status !== "Open" ? (
                          <span
                            className={`font-semibold ${
                              (period.closingBalance ?? 0) >= 0
                                ? "text-green-700"
                                : "text-red-700"
                            }`}
                          >
                            {formatCHF(period.closingBalance)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                        <div className="flex items-center justify-end gap-2">
                          {/* Open → Close button */}
                          {canWriteFinance && period.status === "Open" && (
                            <button
                              onClick={() => {
                                setModalType("close");
                                setModalPeriod(period);
                                setModalNotes("");
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-1.5 text-xs font-medium text-yellow-800 transition-colors hover:bg-yellow-100"
                              title={t("close")}
                            >
                              <CheckCircleIcon className="h-3.5 w-3.5" />
                              {t("close")}
                            </button>
                          )}
                          {/* Closed → Lock button */}
                          {canWriteFinance && period.status === "Closed" && (
                            <button
                              onClick={() => {
                                setModalType("lock");
                                setModalPeriod(period);
                                setModalNotes("");
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                              title={t("lock")}
                            >
                              <LockIcon className="h-3.5 w-3.5" />
                              {t("lock")}
                            </button>
                          )}
                          {/* Closed → Reopen button */}
                          {canWriteFinance && period.status === "Closed" && (
                            <button
                              onClick={() => {
                                setModalType("reopen");
                                setModalPeriod(period);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
                              title={t("reopen")}
                            >
                              <RefreshIcon className="h-3.5 w-3.5" />
                              {t("reopen")}
                            </button>
                          )}
                          {/* Locked → Unlock button (admin only) */}
                          {isAdmin && period.status === "Locked" && (
                            <button
                              onClick={() => {
                                setModalType("unlock");
                                setModalPeriod(period);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                              title={t("unlock")}
                            >
                              <UnlockIcon className="h-3.5 w-3.5" />
                              {t("unlock")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Unified Confirmation Modal */}
      {modalType && (
        <ConfirmModal
          open={true}
          title={modalConfig[modalType].title}
          message={modalConfig[modalType].message}
          showNotes={modalConfig[modalType].showNotes}
          notesLabel={t("notes")}
          notesPlaceholder={t("notesPlaceholder")}
          notes={modalNotes}
          onNotesChange={setModalNotes}
          onConfirm={handleModalConfirm}
          onCancel={() => {
            setModalType(null);
            setModalPeriod(null);
            setModalNotes("");
          }}
          loading={modalLoading}
          tc={tc}
        />
      )}
    </main>
  );
}
