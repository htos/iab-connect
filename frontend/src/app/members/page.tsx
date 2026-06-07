"use client";

/**
 * Member List Page - REQ-016: Mitgliederliste
 * Accessible to Vorstand and Admin only
 */

import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  MemberDto,
  PagedResponse,
  MembershipStatus,
  MembershipType,
  GetMembersParams,
  getMembershipStatusColor,
  getMembershipTypeColor,
  MemberStatisticsDto,
  getStatusTranslationKey,
  getTypeTranslationKey,
} from "@/lib/api/members";

export default function MembersPage() {
  const { isAuthenticated, isLoading: authLoading, isVorstand, isAdmin, accessToken } = useAuth();
  const router = useRouter();
  const t = useTranslations();

  const [members, setMembers] = useState<MemberDto[]>([]);
  const [statistics, setStatistics] = useState<MemberStatisticsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<MembershipStatus | "">("");
  const [typeFilter, setTypeFilter] = useState<MembershipType | "">("");
  const [exportLoading, setExportLoading] = useState(false);

  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

  // Use refs to avoid re-creating callbacks
  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;

  const fetchMembers = useCallback(async (
    currentPage: number,
    search: string,
    status: string,
    type: string
  ) => {
    const token = accessTokenRef.current;
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append("page", currentPage.toString());
      params.append("pageSize", "10");
      if (search) params.append("search", search);
      if (status) params.append("status", status);
      if (type) params.append("type", type);

      const response = await fetch(`${baseUrl}/api/v1/members?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load members: ${response.statusText}`);
      }

      const data: PagedResponse<MemberDto> = await response.json();
      setMembers(data.items);
      setTotalPages(data.totalPages);
      setTotalCount(data.totalCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.errorOccurred"));
    } finally {
      setLoading(false);
    }
  }, [baseUrl, t]);

  const fetchStatistics = useCallback(async () => {
    const token = accessTokenRef.current;
    if (!token) return;

    try {
      const response = await fetch(`${baseUrl}/api/v1/members/statistics`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data: MemberStatisticsDto = await response.json();
        setStatistics(data);
      }
    } catch {
      // Statistics are optional, don't show error
    }
  }, [baseUrl]);

  // Initial data fetch - only once when authenticated
  const initialFetchDone = useRef(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }

    if (!authLoading && isAuthenticated && !isVorstand && !isAdmin) {
      router.push("/");
      return;
    }
  }, [authLoading, isAuthenticated, isVorstand, isAdmin, router]);

  useEffect(() => {
    if (isAuthenticated && (isVorstand || isAdmin) && accessToken && !initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchMembers(page, searchTerm, statusFilter, typeFilter);
      fetchStatistics();
    }
  }, [isAuthenticated, isVorstand, isAdmin, accessToken, fetchMembers, fetchStatistics, page, searchTerm, statusFilter, typeFilter]);

  // Refetch when filters change (but not on initial load)
  const filtersChanged = useRef(false);
  useEffect(() => {
    if (initialFetchDone.current && filtersChanged.current && accessToken) {
      fetchMembers(page, searchTerm, statusFilter, typeFilter);
    }
    filtersChanged.current = true;
  }, [page, searchTerm, statusFilter, typeFilter, accessToken, fetchMembers]);

  const handleExportCsv = async () => {
    const token = accessTokenRef.current;
    if (!token) return;
    setExportLoading(true);
    try {
      const response = await fetch(`${baseUrl}/api/v1/reports/export/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(t("members.exportFailed"));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Mitglieder_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError(t("members.exportFailed"));
    } finally {
      setExportLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t("members.deleteConfirm", { name }))) return;

    try {
      const response = await fetch(`${baseUrl}/api/v1/members/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(t("error.deletingError"));
      }

      fetchMembers(page, searchTerm, statusFilter, typeFilter);
      fetchStatistics();
    } catch (err) {
      alert(err instanceof Error ? err.message : t("error.deletingError"));
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || (!isVorstand && !isAdmin)) {
    return null; // Will redirect
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{t("members.title")}</h1>
            <p className="text-gray-600 mt-1">
              {t("members.totalMembers", { count: totalCount })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={handleExportCsv}
                disabled={exportLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {exportLoading ? t("common.loading") : t("members.exportCsv")}
              </button>
            )}
            <Link
              href="/members/new"
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t("members.addMember")}
            </Link>
          </div>
        </div>

        {/* Statistics Cards */}
        {statistics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="text-2xl font-bold text-green-600">{statistics.activeMembers}</div>
              <div className="text-sm text-gray-500">{t("members.statistics.active")}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="text-2xl font-bold text-yellow-600">{statistics.pendingMembers}</div>
              <div className="text-sm text-gray-500">{t("members.statistics.pending")}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="text-2xl font-bold text-gray-600">{statistics.inactiveMembers}</div>
              <div className="text-sm text-gray-500">{t("members.statistics.inactive")}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="text-2xl font-bold text-red-600">{statistics.suspendedMembers}</div>
              <div className="text-sm text-gray-500">{t("members.statistics.suspended")}</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder={t("members.searchPlaceholder")}
                aria-label={t("members.searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as MembershipStatus | "");
                setPage(1);
              }}
              aria-label={t("members.allStatuses")}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="">{t("members.allStatuses")}</option>
              <option value={MembershipStatus.Active}>{t("status.active")}</option>
              <option value={MembershipStatus.Pending}>{t("status.pending")}</option>
              <option value={MembershipStatus.Inactive}>{t("status.inactive")}</option>
              <option value={MembershipStatus.Suspended}>{t("status.suspended")}</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as MembershipType | "");
                setPage(1);
              }}
              aria-label={t("members.allTypes")}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="">{t("members.allTypes")}</option>
              <option value={MembershipType.Regular}>{t("membershipType.regular")}</option>
              <option value={MembershipType.Student}>{t("membershipType.student")}</option>
              <option value={MembershipType.Family}>{t("membershipType.family")}</option>
              <option value={MembershipType.Honorary}>{t("membershipType.honorary")}</option>
            </select>
            <button
              type="submit"
              className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              {t("common.search")}
            </button>
          </form>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-700">{error}</p>
            <button
              onClick={() => fetchMembers(page, searchTerm, statusFilter, typeFilter)}
              className="mt-2 text-red-600 underline hover:text-red-800"
            >
              {t("common.tryAgain")}
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">{t("common.loadingMembers")}</p>
          </div>
        ) : members.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t("common.noMembersFound")}</h3>
            <p className="text-gray-500">
              {searchTerm || statusFilter || typeFilter
                ? t("common.tryDifferentFilter")
                : t("common.addFirstMember")}
            </p>
          </div>
        ) : (
          <>
            {/* Members Table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t("members.table.name")}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t("members.table.email")}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t("members.table.type")}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t("members.table.status")}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t("members.table.memberSince")}
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t("members.table.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {members.map((member) => (
                      <tr key={member.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 shrink-0 bg-orange-100 rounded-full flex items-center justify-center">
                              <span className="text-orange-600 font-medium">
                                {member.firstName[0]}{member.lastName[0]}
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {member.firstName} {member.lastName}
                              </div>
                              <div className="text-sm text-gray-500">
                                {member.city}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <a href={`mailto:${member.email}`} className="text-sm text-blue-600 hover:underline">
                            {member.email}
                          </a>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getMembershipTypeColor(member.membershipType)}`}>
                            {t(`membershipType.${getTypeTranslationKey(member.membershipType)}`)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getMembershipStatusColor(member.status)}`}>
                            {t(`status.${getStatusTranslationKey(member.status)}`)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(member.memberSince).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/members/${member.id}`}
                              className="text-blue-600 hover:text-blue-900"
                              title={t("common.details")}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </Link>
                            <Link
                              href={`/members/${member.id}/edit`}
                              className="text-orange-600 hover:text-orange-900"
                              title={t("common.edit")}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </Link>
                            {isAdmin && (
                              <button
                                onClick={() => handleDelete(member.id, `${member.firstName} ${member.lastName}`)}
                                className="text-red-600 hover:text-red-900"
                                title={t("common.delete")}
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-gray-700">
                  {t("common.page")} {page} {t("common.of")} {totalPages} ({totalCount} {t("common.entries")})
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t("common.previous")}
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t("common.next")}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
