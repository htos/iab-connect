"use client";

/**
 * Audit Log page content (E27-S4). Feature-slice composition root; the route file
 * is a thin entry rendering this — this is the single `"use client"` boundary.
 *
 * Behaviour preserved verbatim (pinned by the E27-S1 audit net): the admin auth
 * guard (non-admin → `router.push("/")` + `return null`; fetch gated on
 * `isAuthenticated && isAdmin && accessToken`), the 7 SERVER-side filters (each
 * change resets `page:1` + refetches — now via the filters-in-key TanStack query),
 * the collapsible filter panel (default closed), `results.showing`, pagination
 * only when `totalPages > 1` (pageSize=50), and the CSV export (Blob → anchor
 * `audit_export_<date>.csv`). Server-state moves to `useAuditLog`; the filter
 * options to `useAuditFilterOptions`; export to `useExportAudit`.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { useAuditLog } from "../hooks/use-audit-log";
import { useAuditFilterOptions } from "../hooks/use-audit-filter-options";
import { useExportAudit } from "../hooks/use-export-audit";
import { AuditFilterBar } from "./audit-filter-bar";
import { AuditTable } from "./audit-table";
import type { AuditFilterOptions } from "../types/audit.types";

const DEFAULT_FILTERS: AuditFilterOptions = { page: 1, pageSize: 50 };

export function AuditPageContent() {
  const t = useTranslations("audit");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const {
    isAuthenticated,
    isLoading: authLoading,
    isAdmin,
    accessToken,
  } = useAuth();

  const [filters, setFilters] = useState<AuditFilterOptions>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  // Action error (export) only; the LOAD error is DERIVED from the query below so
  // we never mirror server state into local state via an effect (cascading-render
  // smell — the god-page mirrored it because it had no query).
  const [actionError, setActionError] = useState<string | null>(null);

  const gated = Boolean(isAuthenticated && isAdmin && accessToken);

  const { data, isLoading, error: loadError } = useAuditLog(filters, gated);
  const { categories, eventTypes } = useAuditFilterOptions(gated);
  const exportAudit = useExportAudit();

  const events = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 1;

  // The displayed banner: a fresh export action error wins; otherwise the derived
  // load error (god-page parity — both rendered in the same banner, last action
  // wins).
  const error =
    actionError ??
    (loadError
      ? loadError instanceof Error
        ? loadError.message
        : t("errors.loadFailed")
      : null);

  // Redirect if not admin.
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  const handleFilterChange = (
    key: keyof AuditFilterOptions,
    value: string | boolean | undefined
  ) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value === "" ? undefined : value,
      page: 1, // Reset page on filter change.
    }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const clearFilters = () => {
    setFilters({ page: 1, pageSize: 50 });
  };

  const handleExport = async () => {
    setActionError(null);
    try {
      const blob = await exportAudit.mutateAsync(filters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit_export_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : t("errors.exportFailed")
      );
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/admin"
          className="mb-6 inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {t("backToAdmin")}
        </Link>

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
              {t("title")}
            </h1>
            <p className="mt-1 text-gray-600">{t("subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-2 hover:bg-gray-200 focus:ring-2 focus:ring-orange-500 focus:outline-none"
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
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              {t("filters.toggle")}
            </button>
            <button
              onClick={handleExport}
              disabled={exportAudit.isPending}
              className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:outline-none disabled:opacity-50"
            >
              {exportAudit.isPending ? (
                <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white"></div>
              ) : (
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
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              )}
              {t("export")}
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <AuditFilterBar
            filters={filters}
            categories={categories}
            eventTypes={eventTypes}
            onFilterChange={handleFilterChange}
            onClear={clearFilters}
          />
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            <p>{error}</p>
          </div>
        )}

        {/* Results Summary */}
        <div className="mb-4 text-sm text-gray-600">
          {t("results.showing", { count: events.length, total: totalCount })}
        </div>

        {/* Table */}
        <AuditTable events={events} isLoading={isLoading} />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {t("pagination.page", {
                current: filters.page || 1,
                total: totalPages,
              })}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange((filters.page || 1) - 1)}
                disabled={filters.page === 1}
                className="rounded-xl border border-gray-300 px-3 py-1 hover:bg-gray-50 focus:border-orange-500 focus:ring-2 focus:ring-orange-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {tCommon("previous")}
              </button>
              <button
                onClick={() => handlePageChange((filters.page || 1) + 1)}
                disabled={filters.page === totalPages}
                className="rounded-xl border border-gray-300 px-3 py-1 hover:bg-gray-50 focus:border-orange-500 focus:ring-2 focus:ring-orange-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {tCommon("next")}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
