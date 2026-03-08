"use client";

/**
 * Segment Detail Page
 * REQ-017: Segmentierung & Verteiler
 */
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth, useApiClient } from "@/lib/auth";
import {
  MemberSegmentDto,
  SegmentMemberDto,
  SegmentCriteria,
  getSegmentColorClasses,
} from "@/lib/api/member-segments";

interface PagedMembers {
  items: SegmentMemberDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface MemberSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface PagedMemberSearch {
  items: MemberSearchResult[];
  totalCount: number;
}

export default function SegmentDetailPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const segmentId = params.id as string;
  const { isAuthenticated, isLoading, isAdmin, isVorstand } = useAuth();
  const api = useApiClient();

  const [segment, setSegment] = useState<MemberSegmentDto | null>(null);
  const [members, setMembers] = useState<SegmentMemberDto[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [memberPage, setMemberPage] = useState(1);
  const [memberTotalPages, setMemberTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [memberSearchResults, setMemberSearchResults] = useState<MemberSearchResult[]>([]);
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [searchingMembers, setSearchingMembers] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const memberPageSize = 20;

  // Auth guard
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    } else if (!isLoading && isAuthenticated && !isAdmin && !isVorstand) {
      router.push("/");
    }
  }, [isAuthenticated, isLoading, isAdmin, isVorstand, router]);

  // Load segment data
  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    let cancelled = false;
    const loadSegment = async () => {
      if (refreshKey === 0) setLoading(true);
      const { data, error: apiError } = await api.get<MemberSegmentDto>(
        `/api/v1/member-segments/${segmentId}`
      );
      if (cancelled) return;
      if (apiError) {
        setError(apiError);
      } else if (data) {
        setSegment(data);
      }
      setLoading(false);
    };
    loadSegment();
    return () => { cancelled = true; };
  }, [isAuthenticated, isLoading, api, segmentId, refreshKey]);

  // Load members list (triggered by page change or refreshKey)
  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    let cancelled = false;
    const loadMembers = async () => {
      setMembersLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(memberPage));
      params.set("pageSize", String(memberPageSize));
      const { data, error: apiError } = await api.get<PagedMembers>(
        `/api/v1/member-segments/${segmentId}/members?${params.toString()}`
      );
      if (cancelled) return;
      if (apiError) {
        setError(apiError);
      } else if (data) {
        setMembers(data.items);
        setMemberCount(data.totalCount);
        setMemberTotalPages(data.totalPages);
      }
      setMembersLoading(false);
    };
    loadMembers();
    return () => { cancelled = true; };
  }, [isAuthenticated, isLoading, api, segmentId, memberPage, refreshKey]);

  const handleDelete = async () => {
    const { error: apiError } = await api.delete(`/api/v1/member-segments/${segmentId}`);
    if (apiError) {
      setError(apiError);
      setDeleting(false);
    } else {
      router.push("/members/segments");
    }
  };

  const handleAddMember = async (memberId: string) => {
    setAddingMember(true);
    setError(null);
    const { error: apiError } = await api.post(
      `/api/v1/member-segments/${segmentId}/members`,
      { memberId }
    );
    if (apiError) {
      setError(apiError);
    } else {
      setMemberSearchQuery("");
      setMemberSearchResults([]);
      setMemberSearchOpen(false);
      setRefreshKey((k) => k + 1);
    }
    setAddingMember(false);
  };

  const searchMembers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setMemberSearchResults([]);
      setMemberSearchOpen(false);
      return;
    }
    setSearchingMembers(true);
    const params = new URLSearchParams();
    params.set("search", query);
    params.set("page", "1");
    params.set("pageSize", "10");
    const { data } = await api.get<PagedMemberSearch>(
      `/api/v1/members?${params.toString()}`
    );
    if (data) {
      setMemberSearchResults(data.items);
      setMemberSearchOpen(true);
    }
    setSearchingMembers(false);
  }, [api]);

  const handleMemberSearchChange = (value: string) => {
    setMemberSearchQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchMembers(value), 300);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setMemberSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleRemoveMember = async (memberId: string) => {
    setError(null);
    const { error: apiError } = await api.delete(
      `/api/v1/member-segments/${segmentId}/members/${memberId}`
    );
    if (apiError) {
      setError(apiError);
    } else {
      setRemovingMemberId(null);
      setRefreshKey((k) => k + 1);
    }
  };

  const handleExport = async () => {
    if (!segment) return;
    const { data, error: apiError } = await api.get<Blob>(
      `/api/v1/member-segments/${segmentId}/export`
    );
    if (apiError) {
      setError(apiError);
      return;
    }
    if (data instanceof Blob) {
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `segment_${segment.name.replace(/\s+/g, "_")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const parseCriteria = (): SegmentCriteria | null => {
    if (!segment?.criteriaJson) return null;
    try {
      return JSON.parse(segment.criteriaJson) as SegmentCriteria;
    } catch {
      return null;
    }
  };

  if (isLoading || loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
      </div>
    );
  }

  if (!segment) {
    return (
      <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center py-12">
          <p className="text-gray-500">{t("segments.notFound")}</p>
          <Link href="/members/segments" className="text-orange-600 hover:text-orange-800 mt-4 inline-block">
            {t("segments.backToList")}
          </Link>
        </div>
      </main>
    );
  }

  const criteria = parseCriteria();

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        {/* Navigation */}
        <Link
          href="/members/segments"
          className="text-sm text-orange-600 hover:text-orange-800 mb-4 inline-flex items-center gap-1"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t("segments.title")}
        </Link>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div className="flex items-center gap-3">
            {segment.color && (
              <span
                className={`inline-flex items-center justify-center h-12 w-12 rounded-full text-lg font-bold ${getSegmentColorClasses(segment.color)}`}
              >
                {segment.name.charAt(0).toUpperCase()}
              </span>
            )}
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                {segment.name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  segment.segmentType === "Dynamic"
                    ? "bg-purple-100 text-purple-800"
                    : "bg-blue-100 text-blue-800"
                }`}>
                  {t(`segments.type.${segment.segmentType.toLowerCase()}`)}
                </span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  segment.isActive
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-800"
                }`}>
                  {segment.isActive ? t("segments.status.active") : t("segments.status.inactive")}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t("segments.action.export")}
            </button>
            <Link
              href={`/members/segments/${segmentId}/edit`}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 transition-colors"
            >
              {t("segments.editSegment")}
            </Link>
            {isAdmin && (
              deleting ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDelete}
                    className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    {t("common.confirm")}
                  </button>
                  <button
                    onClick={() => setDeleting(false)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleting(true)}
                  className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 transition-colors"
                >
                  {t("common.delete")}
                </button>
              )
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Segment Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 md:col-span-2">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {t("segments.section.details")}
            </h2>
            {segment.description && (
              <p className="text-gray-700 mb-4">{segment.description}</p>
            )}

            {/* Dynamic criteria summary */}
            {segment.segmentType === "Dynamic" && criteria && (
              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  {t("segments.section.criteria")}
                </h3>
                <div className="space-y-2 text-sm">
                  {criteria.status && criteria.status.length > 0 && (
                    <p>
                      <span className="font-medium text-gray-600">{t("segments.criteria.status")}:</span>{" "}
                      {criteria.status.map((s) => t(`status.${s.toLowerCase()}`)).join(", ")}
                    </p>
                  )}
                  {criteria.type && criteria.type.length > 0 && (
                    <p>
                      <span className="font-medium text-gray-600">{t("segments.criteria.type")}:</span>{" "}
                      {criteria.type.map((ty) => t(`membershipType.${ty.toLowerCase()}`)).join(", ")}
                    </p>
                  )}
                  {(criteria.memberSince?.from || criteria.memberSince?.to) && (
                    <p>
                      <span className="font-medium text-gray-600">{t("segments.criteria.memberSince")}:</span>{" "}
                      {criteria.memberSince?.from && `${t("segments.from")} ${criteria.memberSince.from}`}
                      {criteria.memberSince?.from && criteria.memberSince?.to && " "}
                      {criteria.memberSince?.to && `${t("segments.to")} ${criteria.memberSince.to}`}
                    </p>
                  )}
                  {criteria.city && (
                    <p>
                      <span className="font-medium text-gray-600">{t("segments.criteria.city")}:</span>{" "}
                      {criteria.city}
                    </p>
                  )}
                  {criteria.country && (
                    <p>
                      <span className="font-medium text-gray-600">{t("segments.criteria.country")}:</span>{" "}
                      {criteria.country}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Stats Card */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {t("segments.section.stats")}
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">{t("segments.table.members")}</p>
                <p className="text-2xl font-bold text-gray-900">{segment.memberCount}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">{t("segments.field.createdAt")}</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(segment.createdAt).toLocaleDateString("de-CH", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Add Member (Static segments only) */}
        {segment.segmentType === "Static" && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {t("segments.action.addMember")}
            </h2>
            <div className="relative" ref={searchContainerRef}>
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder={t("segments.searchMemberPlaceholder")}
                    value={memberSearchQuery}
                    onChange={(e) => handleMemberSearchChange(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                  {searchingMembers && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                    </div>
                  )}
                </div>
              </div>
              {/* Dropdown */}
              {memberSearchOpen && memberSearchResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                  {memberSearchResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      disabled={addingMember}
                      onClick={() => handleAddMember(result.id)}
                      className="w-full text-left px-4 py-3 hover:bg-orange-50 border-b border-gray-100 last:border-b-0 transition-colors disabled:opacity-50"
                    >
                      <p className="text-sm font-medium text-gray-900">
                        {result.firstName} {result.lastName}
                      </p>
                      <p className="text-xs text-gray-500">{result.email}</p>
                    </button>
                  ))}
                </div>
              )}
              {memberSearchOpen && memberSearchQuery.length >= 2 && memberSearchResults.length === 0 && !searchingMembers && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg p-4">
                  <p className="text-sm text-gray-500 text-center">{t("segments.noSearchResults")}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Members List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              {t("segments.section.members")} ({memberCount})
            </h2>
          </div>

          {membersLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
            </div>
          ) : members.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-500">{t("segments.noMembers")}</p>
            </div>
          ) : (
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
                  {segment.segmentType === "Static" && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t("segments.table.actions")}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link
                        href={`/members/${member.id}`}
                        className="font-medium text-gray-900 hover:text-orange-600"
                      >
                        {member.firstName} {member.lastName}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {member.email}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {t(`membershipType.${member.membershipType.toLowerCase()}`)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        member.status === "Active"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}>
                        {t(`status.${member.status.toLowerCase()}`)}
                      </span>
                    </td>
                    {segment.segmentType === "Static" && (
                      <td className="px-6 py-4 text-right">
                        {removingMemberId === member.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleRemoveMember(member.id)}
                              className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              {t("common.confirm")}
                            </button>
                            <button
                              onClick={() => setRemovingMemberId(null)}
                              className="text-xs px-2 py-1 border rounded text-gray-700 hover:bg-gray-50"
                            >
                              {t("common.cancel")}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setRemovingMemberId(member.id)}
                            className="text-sm text-red-600 hover:text-red-800"
                          >
                            {t("segments.action.remove")}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Members Pagination */}
          {memberTotalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {t("common.page")} {memberPage} / {memberTotalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setMemberPage(Math.max(1, memberPage - 1))}
                  disabled={memberPage === 1}
                  className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  {t("common.previous")}
                </button>
                <button
                  onClick={() => setMemberPage(Math.min(memberTotalPages, memberPage + 1))}
                  disabled={memberPage === memberTotalPages}
                  className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  {t("common.next")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
