"use client";

/**
 * Audit Log Page
 * REQ-011: Audit Log (Sicherheits- & Datenänderungen)
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import {
  getAuditEvents,
  exportAuditEvents,
  getAuditCategories,
  getAuditEventTypes,
  AuditEvent,
  AuditCategory,
  AuditEventType,
  AuditFilterOptions,
  getSeverityColor,
  getCategoryColor,
  formatAuditDate,
} from "@/lib/api/audit";

export default function AuditPage() {
  const t = useTranslations("audit");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, isAdmin, accessToken } = useAuth();

  // Data state
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [categories, setCategories] = useState<AuditCategory[]>([]);
  const [eventTypes, setEventTypes] = useState<AuditEventType[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filter state
  const [filters, setFilters] = useState<AuditFilterOptions>({
    page: 1,
    pageSize: 50,
  });

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Fetch filter options
  const fetchFilterOptions = useCallback(async () => {
    if (!accessToken) return;

    try {
      const [cats, types] = await Promise.all([
        getAuditCategories(accessToken),
        getAuditEventTypes(accessToken),
      ]);
      setCategories(cats);
      setEventTypes(types);
    } catch (err) {
      console.error("Failed to load filter options:", err);
    }
  }, [accessToken]);

  // Fetch audit events
  const fetchEvents = useCallback(async () => {
    if (!accessToken) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await getAuditEvents(accessToken, filters);
      setEvents(response.items);
      setTotalCount(response.totalCount);
      setTotalPages(response.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, filters, t]);

  useEffect(() => {
    if (isAuthenticated && isAdmin && accessToken) {
      fetchFilterOptions();
      fetchEvents();
    }
  }, [isAuthenticated, isAdmin, accessToken, fetchFilterOptions, fetchEvents]);

  // Redirect if not admin
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  // Handle filter change
  const handleFilterChange = (key: keyof AuditFilterOptions, value: string | boolean | undefined) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value === "" ? undefined : value,
      page: 1, // Reset page on filter change
    }));
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  // Handle CSV export
  const handleExport = async () => {
    if (!accessToken) return;

    setIsExporting(true);
    try {
      const blob = await exportAuditEvents(accessToken, filters);

      // Download file
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit_export_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.exportFailed"));
    } finally {
      setIsExporting(false);
    }
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({ page: 1, pageSize: 50 });
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-gray-600 mt-1">{t("description")}</p>
        </div>
        <div className="flex gap-2 mt-4 md:mt-0">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {t("filters.toggle")}
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            {isExporting ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
            {t("export")}
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("filters.fromDate")}
              </label>
              <input
                type="date"
                value={filters.fromDate?.split("T")[0] || ""}
                onChange={(e) => handleFilterChange("fromDate", e.target.value ? new Date(e.target.value).toISOString() : undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("filters.toDate")}
              </label>
              <input
                type="date"
                value={filters.toDate?.split("T")[0] || ""}
                onChange={(e) => handleFilterChange("toDate", e.target.value ? new Date(e.target.value).toISOString() : undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("filters.category")}
              </label>
              <select
                value={filters.category || ""}
                onChange={(e) => handleFilterChange("category", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t("filters.all")}</option>
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Event Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("filters.eventType")}
              </label>
              <select
                value={filters.eventType || ""}
                onChange={(e) => handleFilterChange("eventType", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t("filters.all")}</option>
                {eventTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Severity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("filters.severity")}
              </label>
              <select
                value={filters.severity || ""}
                onChange={(e) => handleFilterChange("severity", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t("filters.all")}</option>
                <option value="Info">{t("severity.info")}</option>
                <option value="Warning">{t("severity.warning")}</option>
                <option value="Critical">{t("severity.critical")}</option>
              </select>
            </div>

            {/* Success/Failure */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("filters.status")}
              </label>
              <select
                value={filters.success === undefined ? "" : String(filters.success)}
                onChange={(e) => handleFilterChange("success", e.target.value === "" ? undefined : e.target.value === "true")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t("filters.all")}</option>
                <option value="true">{t("status.success")}</option>
                <option value="false">{t("status.failure")}</option>
              </select>
            </div>

            {/* Search */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("filters.search")}
              </label>
              <input
                type="text"
                value={filters.search || ""}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                placeholder={t("filters.searchPlaceholder")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              {t("filters.clear")}
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Results Summary */}
      <div className="text-sm text-gray-600 mb-4">
        {t("results.showing", { count: events.length, total: totalCount })}
      </div>

      {/* Table */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("table.timestamp")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("table.category")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("table.eventType")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("table.user")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("table.action")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("table.status")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("table.severity")}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    {t("table.noResults")}
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {formatAuditDate(event.timestamp)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(event.category)}`}>
                        {event.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {event.eventType}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {event.userName || event.userId || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate" title={event.action}>
                      {event.action}
                      {event.entityType && (
                        <span className="text-gray-500 ml-1">
                          ({event.entityType}{event.entityId ? `: ${event.entityId}` : ""})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {event.success ? (
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          {t("status.success")}
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800" title={event.errorMessage || undefined}>
                          {t("status.failure")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(event.severity)}`}>
                        {event.severity}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-gray-600">
            {t("pagination.page", { current: filters.page || 1, total: totalPages })}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange((filters.page || 1) - 1)}
              disabled={filters.page === 1}
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {tCommon("previous")}
            </button>
            <button
              onClick={() => handlePageChange((filters.page || 1) + 1)}
              disabled={filters.page === totalPages}
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {tCommon("next")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
