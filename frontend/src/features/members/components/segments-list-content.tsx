"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth, useApiClient } from "@/lib/auth";
import { PageShell, PageHeader } from "@/components/layout";
import { useSegments } from "../hooks/use-segments";
import { useDeleteSegment } from "../hooks/use-delete-segment";
import { exportSegmentCsv } from "../api/member-segments-api";
import { getSegmentColorClasses } from "../types/member-segment.types";

/**
 * Member Segments list composition root (E23-S4) — the only `"use client"`
 * boundary for `/members/segments`. Behaviour-preserving: Vorstand/Admin guard
 * (unauth → /login; unauthorized → /; no fetch fires via the `enabled` gate);
 * search-on-Enter + type/active filters each reset page; colour avatar; member
 * count; pagination; CSV export; the inline two-step delete (Admin-only —
 * DEC-2=A: deliberately NOT migrated to the slice-standard alert-dialog to avoid
 * changing a working accessible interaction). Server state via TanStack
 * `useSegments` (replacing the manual `useState`/`useEffect`/`refreshKey`).
 */
export function SegmentsListContent() {
  const t = useTranslations();
  const router = useRouter();
  const { isAuthenticated, isLoading, isAdmin, isVorstand } = useAuth();
  const api = useApiClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }
    if (!isLoading && isAuthenticated && !isAdmin && !isVorstand) {
      router.push("/");
    }
  }, [isAuthenticated, isLoading, isAdmin, isVorstand, router]);

  const enabled = isAuthenticated && (isAdmin || isVorstand);
  const {
    data,
    isLoading: listLoading,
    error: listError,
  } = useSegments(
    { page, search: submittedSearch, type: typeFilter, active: activeFilter },
    enabled
  );
  const deleteMutation = useDeleteSegment();

  const segments = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const error = actionError ?? (listError ? listError.message : null);

  const handleSearch = () => {
    setPage(1);
    setSubmittedSearch(search);
  };

  const handleDelete = (id: string) => {
    setActionError(null);
    deleteMutation.mutate(id, {
      onSuccess: () => setDeletingId(null),
      onError: (err) => setActionError(err.message),
    });
  };

  const handleExport = async (id: string, name: string) => {
    const { data: blob, error: apiError } = await exportSegmentCsv(api, id);
    if (apiError) {
      setActionError(apiError);
      return;
    }
    if (blob instanceof Blob) {
      const url = URL.createObjectURL(blob);
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
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
          <p className="mt-4 text-gray-600">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <PageShell
      header={
        <PageHeader
          title={t("segments.title")}
          description={t("segments.subtitle")}
          actions={
            <Link
              href="/members/segments/new"
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700"
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              {t("segments.action.create")}
            </Link>
          }
        />
      }
    >
      {/* Error Alert */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex-1">
            <input
              type="text"
              placeholder={t("segments.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">{t("segments.filter.allTypes")}</option>
            <option value="Static">{t("segments.type.static")}</option>
            <option value="Dynamic">{t("segments.type.dynamic")}</option>
          </select>
          <select
            value={activeFilter}
            onChange={(e) => {
              setActiveFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">{t("segments.filter.allStatus")}</option>
            <option value="true">{t("segments.filter.active")}</option>
            <option value="false">{t("segments.filter.inactive")}</option>
          </select>
          <button
            onClick={handleSearch}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-700"
          >
            {t("common.search")}
          </button>
        </div>
      </div>

      {/* Summary */}
      <p className="mb-4 text-sm text-gray-500">
        {t("segments.totalCount", { count: totalCount })}
      </p>

      {/* Segments Table */}
      {listLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-orange-600"></div>
        </div>
      ) : segments.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <p className="text-gray-500">{t("segments.empty")}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  {t("segments.table.name")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  {t("segments.table.type")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  {t("segments.table.members")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  {t("segments.table.status")}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
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
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${getSegmentColorClasses(
                            segment.color
                          )}`}
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
                          <p className="max-w-xs truncate text-sm text-gray-500">
                            {segment.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        segment.segmentType === "Dynamic"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {t(`segments.type.${segment.segmentType.toLowerCase()}`)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-gray-900">
                      {segment.memberCount}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        segment.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {segment.isActive
                        ? t("segments.status.active")
                        : t("segments.status.inactive")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleExport(segment.id, segment.name)}
                        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                        title={t("segments.action.export")}
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </button>
                      <Link
                        href={`/members/segments/${segment.id}`}
                        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                        title={t("common.edit")}
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </Link>
                      {isAdmin &&
                        (deletingId === segment.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(segment.id)}
                              className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                            >
                              {t("common.confirm")}
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="rounded border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                            >
                              {t("common.cancel")}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeletingId(segment.id)}
                            className="rounded-lg p-2 text-red-600 hover:bg-red-50 hover:text-red-800"
                            title={t("common.delete")}
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        ))}
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
              className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {t("common.previous")}
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {t("common.next")}
            </button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
