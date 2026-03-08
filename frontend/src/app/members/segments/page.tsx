"use client";

/**
 * Member Segments List Page
 * REQ-017: Segmentierung & Verteiler
 */
import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth, useApiClient } from "@/lib/auth";
import {
  MemberSegmentDto,
  SegmentType,
  getSegmentColorClasses,
} from "@/lib/api/member-segments";

interface PagedSegments {
  items: MemberSegmentDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function MemberSegmentsPage() {
  const t = useTranslations();
  const router = useRouter();
  const { isAuthenticated, isLoading, isAdmin, isVorstand } = useAuth();
  const api = useApiClient();

  const [segments, setSegments] = useState<MemberSegmentDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const initialFetchDone = useRef(false);
  const pageSize = 20;

  const fetchSegments = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (search) params.set("search", search);
    if (typeFilter !== "all") params.set("segmentType", typeFilter);
    if (activeFilter !== "all") params.set("isActive", activeFilter);

    const { data, error: apiError } = await api.get<PagedSegments>(
      `/api/v1/member-segments?${params.toString()}`
    );

    if (apiError) {
      setError(apiError);
    } else if (data) {
      setSegments(data.items);
      setTotalCount(data.totalCount);
      setTotalPages(data.totalPages);
    }
    setLoading(false);
  }, [api, page, search, typeFilter, activeFilter]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }
    if (!isLoading && isAuthenticated && !isAdmin && !isVorstand) {
      router.push("/");
      return;
    }
    if (isAuthenticated && !initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchSegments();
    }
  }, [isAuthenticated, isLoading, isAdmin, isVorstand, router, fetchSegments]);

  useEffect(() => {
    if (initialFetchDone.current) {
      fetchSegments();
    }
  }, [page, typeFilter, activeFilter, fetchSegments]);

  const handleSearch = () => {
    setPage(1);
    fetchSegments();
  };

  const handleDelete = async (id: string) => {
    const { error: apiError } = await api.delete(`/api/v1/member-segments/${id}`);
    if (apiError) {
      setError(apiError);
    } else {
      setDeletingId(null);
      fetchSegments();
    }
  };

  const handleExport = async (id: string, name: string) => {
    const { data, error: apiError } = await api.get<Blob>(
      `/api/v1/member-segments/${id}/export`
    );
    if (apiError) {
      setError(apiError);
      return;
    }
    if (data instanceof Blob) {
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `segment_${name.replace(/\s+/g, "_")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              {t("segments.title")}
            </h1>
            <p className="text-gray-600 mt-1">
              {t("segments.subtitle")}
            </p>
          </div>
          <Link
            href="/members/segments/new"
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t("segments.action.create")}
          </Link>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder={t("segments.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="all">{t("segments.filter.allTypes")}</option>
              <option value="Static">{t("segments.type.static")}</option>
              <option value="Dynamic">{t("segments.type.dynamic")}</option>
            </select>
            <select
              value={activeFilter}
              onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="all">{t("segments.filter.allStatus")}</option>
              <option value="true">{t("segments.filter.active")}</option>
              <option value="false">{t("segments.filter.inactive")}</option>
            </select>
            <button
              onClick={handleSearch}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 transition-colors"
            >
              {t("common.search")}
            </button>
          </div>
        </div>

        {/* Summary */}
        <p className="text-sm text-gray-500 mb-4">
          {t("segments.totalCount", { count: totalCount })}
        </p>

        {/* Segments Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
          </div>
        ) : segments.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <p className="text-gray-500">{t("segments.empty")}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("segments.table.name")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("segments.table.type")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("segments.table.members")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("segments.table.status")}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("segments.table.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {segments.map((segment) => (
                  <tr key={segment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {segment.color && (
                          <span
                            className={`inline-flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold ${getSegmentColorClasses(segment.color)}`}
                          >
                            {segment.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div>
                          <Link
                            href={`/members/segments/${segment.id}`}
                            className="font-medium text-gray-900 hover:text-orange-600"
                          >
                            {segment.name}
                          </Link>
                          {segment.description && (
                            <p className="text-sm text-gray-500 truncate max-w-xs">
                              {segment.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        segment.segmentType === "Dynamic"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-blue-100 text-blue-800"
                      }`}>
                        {t(`segments.type.${segment.segmentType.toLowerCase()}`)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900 font-medium">
                        {segment.memberCount}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        segment.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}>
                        {segment.isActive ? t("segments.status.active") : t("segments.status.inactive")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleExport(segment.id, segment.name)}
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                          title={t("segments.action.export")}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                        <Link
                          href={`/members/segments/${segment.id}`}
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                          title={t("common.edit")}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Link>
                        {isAdmin && (
                          deletingId === segment.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(segment.id)}
                                className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                              >
                                {t("common.confirm")}
                              </button>
                              <button
                                onClick={() => setDeletingId(null)}
                                className="text-xs px-2 py-1 border rounded text-gray-700 hover:bg-gray-50"
                              >
                                {t("common.cancel")}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeletingId(segment.id)}
                              className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg"
                              title={t("common.delete")}
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )
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
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {t("common.page")} {page} / {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                {t("common.previous")}
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                {t("common.next")}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
