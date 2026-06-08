"use client";

/**
 * Events List Page content — REQ-019. Visible to any authenticated user;
 * manager-only affordances (Create, status filter, statistics cards) gate on
 * Vorstand/Admin.
 *
 * Feature-slice composition root (E24-S2). The route file
 * `app/(dashboard)/events/page.tsx` is a thin server entry that renders this
 * component; this is the single `"use client"` boundary. Data lives in TanStack
 * hooks (`use-events`, `use-event-statistics`); URLs in `api/events-api`.
 *
 * Behaviour preserved verbatim (pinned by the E24-S1 characterization suite):
 * auth spinner + `/login` redirect, SERVER-side search/status/category/page
 * filtering (all in the query key), the 300ms search debounce, `pageSize=12`,
 * grid/list view toggle (grid default), manager-gated affordances, statistics
 * cards (managers + payload present only; stats errors SILENTLY ignored),
 * pagination bounds, loading/error/empty states and the error-banner retry.
 *
 * Statistics QUIRK (E24-S2): the god-page reads its own inline stats shape
 * `{ totalEvents, upcomingEvents, publishedEvents, draftEvents }` from
 * `/api/v1/events/statistics`; the slice api types it as the canonical
 * `EventStatistics` (different field names). We cast the hook's `data` to that
 * inline shape so the cards read the exact same fields the god-page did.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useApiClient, useAuth } from "@/lib/auth";
import { useEvents } from "../hooks/use-events";
import { useEventStatistics } from "../hooks/use-event-statistics";
import { EventsFilterBar } from "./events-filter-bar";
import { EventsGrid } from "./events-grid";
import { EventsTable } from "./events-table";

// The inline statistics shape the god-page rendered from /events/statistics.
interface InlineEventStatistics {
  totalEvents: number;
  upcomingEvents: number;
  publishedEvents: number;
  draftEvents: number;
}

export function EventsPageContent() {
  const t = useTranslations("events");
  const tCommon = useTranslations("common");
  const {
    isAuthenticated,
    isLoading: authLoading,
    isVorstand,
    isAdmin,
  } = useAuth();
  // useApiClient is consumed by the hooks; reading it here keeps the slice's
  // transport contract explicit and lets the test assert the spy client.
  useApiClient();
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const canManageEvents = isVorstand || isAdmin;

  // Redirect unauthenticated users to /login (god-page parity). No list call
  // fires while unauthenticated because the query `enabled` gate is false.
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // 300ms debounce on the search term (god-page parity): the debounced value
  // feeds the query key so per-keystroke typing does not refetch on every
  // character. Status/category/page apply immediately. On mount both values are
  // "" so the initial timeout is a no-op (no synchronous set-in-effect).
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const enabled = !authLoading && isAuthenticated;

  const {
    data: pageData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useEvents(
    {
      page,
      search: debouncedSearch,
      status: statusFilter,
      category: categoryFilter,
    },
    enabled
  );

  const { data: statsData } = useEventStatistics(enabled && canManageEvents);
  // Cast to the inline shape the god-page rendered (statistics QUIRK above).
  const statistics = statsData as InlineEventStatistics | undefined;

  const events = pageData?.items ?? [];
  const totalPages = pageData?.totalPages ?? 1;
  const totalCount = pageData?.totalCount ?? 0;

  // god-page parity: the spinner shows while the list is loading/fetching.
  const loading = isLoading || isFetching;
  const errorMessage = error ? error.message : null;

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setPage(1);
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleCategoryFilter = (value: string) => {
    setCategoryFilter(value);
    setPage(1);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3">
          <svg
            className="h-6 w-6 animate-spin text-orange-600"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-gray-600">{tCommon("loading")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t("title")}</h1>
            <p className="mt-2 text-gray-500">
              {t("totalEvents", { count: totalCount })}
            </p>
          </div>
          {canManageEvents && (
            <Link
              href="/events/new"
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              {t("createEvent")}
            </Link>
          )}
        </div>

        {/* Statistics (for Vorstand/Admin) */}
        {canManageEvents && statistics && (
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">{tCommon("total")}</p>
              <p className="text-2xl font-bold text-gray-900">
                {statistics.totalEvents}
              </p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">{t("status.published")}</p>
              <p className="text-2xl font-bold text-green-600">
                {statistics.publishedEvents}
              </p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">{t("status.draft")}</p>
              <p className="text-2xl font-bold text-gray-600">
                {statistics.draftEvents}
              </p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">
                {t("detail.participants")}
              </p>
              <p className="text-2xl font-bold text-blue-600">
                {statistics.upcomingEvents}
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <EventsFilterBar
          searchTerm={searchTerm}
          onSearchChange={handleSearch}
          categoryFilter={categoryFilter}
          onCategoryChange={handleCategoryFilter}
          statusFilter={statusFilter}
          onStatusChange={handleStatusFilter}
          canManageEvents={canManageEvents}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* Error State */}
        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-3">
              <svg
                className="h-5 w-5 shrink-0 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-red-800">{errorMessage}</p>
              <button
                onClick={() => refetch()}
                className="ml-auto text-sm text-red-600 underline hover:text-red-800"
              >
                {tCommon("tryAgain")}
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <svg
              className="h-8 w-8 animate-spin text-orange-600"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        )}

        {/* Empty State */}
        {!loading && events.length === 0 && (
          <div className="rounded-xl bg-white p-12 text-center shadow-sm">
            <svg
              className="mx-auto h-16 w-16 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              {t("noEvents")}
            </h3>
            <p className="mt-2 text-gray-500">{t("noEventsDescription")}</p>
            {canManageEvents && (
              <Link
                href="/events/new"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                {t("createEvent")}
              </Link>
            )}
          </div>
        )}

        {/* Events Grid */}
        {!loading && events.length > 0 && viewMode === "grid" && (
          <EventsGrid events={events} />
        )}

        {/* Events List View */}
        {!loading && events.length > 0 && viewMode === "list" && (
          <EventsTable
            events={events}
            onRowClick={(id) => router.push(`/events/${id}`)}
          />
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">
              {tCommon("page")} {page} {tCommon("of")} {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {tCommon("previous")}
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {tCommon("next")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
