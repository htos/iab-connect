"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth, useApiClient } from "@/lib/auth";
import { PageShell } from "@/components/layout";
import { searchMembers, type MemberSearchResultDto } from "../api/members-api";
import { exportSegmentCsv } from "../api/member-segments-api";
import { useSegment } from "../hooks/use-segment";
import { useSegmentMembers } from "../hooks/use-segment-members";
import { useAddSegmentMember } from "../hooks/use-add-segment-member";
import { useRemoveSegmentMember } from "../hooks/use-remove-segment-member";
import { useDeleteSegment } from "../hooks/use-delete-segment";
import {
  getSegmentColorClasses,
  type SegmentCriteria,
} from "../types/member-segment.types";

/**
 * Segment detail composition root (E23-S4) — the only `"use client"` boundary for
 * `/members/segments/[id]`. Behaviour-preserving: auth guard (unauth → /login;
 * unauthorized → / — QUIRK: the data load is gated only on auth, NOT role, so the
 * segment + members GETs still fire after the redirect, matching the god-page);
 * not-found state (a 404 OR a GET error both render `segments.notFound`, the error
 * string never shown); Admin-only inline two-step delete (DEC-2=A: NOT migrated to
 * an alert-dialog); debounced (300ms, min-2-char, outside-click-close) member
 * typeahead via the members `searchMembers` (cross-feature, A62); add/remove
 * member (Static-only, inline confirm) now driven by `invalidateQueries` instead
 * of the god-page `refreshKey`; CSV export. Server state via TanStack.
 */
export function SegmentDetailContent() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const segmentId = params.id as string;
  const { isAuthenticated, isLoading, isAdmin, isVorstand } = useAuth();
  const api = useApiClient();

  const [memberPage, setMemberPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [memberSearchResults, setMemberSearchResults] = useState<
    MemberSearchResultDto[]
  >([]);
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [searchingMembers, setSearchingMembers] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Auth guard (QUIRK: redirect only — the data load below is gated on auth, not
  // role, so the GETs still fire for an unauthorized user, matching the god-page).
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    } else if (!isLoading && isAuthenticated && !isAdmin && !isVorstand) {
      router.push("/");
    }
  }, [isAuthenticated, isLoading, isAdmin, isVorstand, router]);

  const enabled = isAuthenticated && !isLoading;
  const { data: segment, isLoading: loading } = useSegment(segmentId, enabled);
  const { data: membersData, isLoading: membersLoading } = useSegmentMembers(
    segmentId,
    memberPage,
    enabled
  );
  const deleteMutation = useDeleteSegment();
  const addMutation = useAddSegmentMember(segmentId);
  const removeMutation = useRemoveSegmentMember(segmentId);

  const members = membersData?.items ?? [];
  const memberCount = membersData?.totalCount ?? 0;
  const memberTotalPages = membersData?.totalPages ?? 1;

  const handleDelete = () => {
    setError(null);
    deleteMutation.mutate(segmentId, {
      onSuccess: () => router.push("/members/segments"),
      onError: (err) => {
        setError(err.message);
        setDeleting(false);
      },
    });
  };

  const handleAddMember = (memberId: string) => {
    setError(null);
    addMutation.mutate(memberId, {
      onSuccess: () => {
        setMemberSearchQuery("");
        setMemberSearchResults([]);
        setMemberSearchOpen(false);
      },
      onError: (err) => setError(err.message),
    });
  };

  const runSearch = async (query: string) => {
    if (query.length < 2) {
      setMemberSearchResults([]);
      setMemberSearchOpen(false);
      return;
    }
    setSearchingMembers(true);
    const { data } = await searchMembers(api, query);
    if (data) {
      setMemberSearchResults(data.items);
      setMemberSearchOpen(true);
    }
    setSearchingMembers(false);
  };

  const handleMemberSearchChange = (value: string) => {
    setMemberSearchQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => runSearch(value), 300);
  };

  // Close dropdown when clicking outside.
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setMemberSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleRemoveMember = (memberId: string) => {
    setError(null);
    removeMutation.mutate(memberId, {
      onSuccess: () => setRemovingMemberId(null),
      onError: (err) => setError(err.message),
    });
  };

  const handleExport = async () => {
    if (!segment) return;
    const { data: blob, error: apiError } = await exportSegmentCsv(
      api,
      segmentId
    );
    if (apiError) {
      setError(apiError);
      return;
    }
    if (blob instanceof Blob) {
      const url = URL.createObjectURL(blob);
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
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!segment) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
        <div className="mx-auto max-w-4xl py-12 text-center">
          <p className="text-gray-500">{t("segments.notFound")}</p>
          <Link
            href="/members/segments"
            className="mt-4 inline-block text-orange-600 hover:text-orange-800"
          >
            {t("segments.backToList")}
          </Link>
        </div>
      </main>
    );
  }

  const criteria = parseCriteria();

  return (
    <PageShell maxWidth="4xl">
      {/* Navigation */}
      <Link
        href="/members/segments"
        className="mb-4 inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-800"
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
            d="M15 19l-7-7 7-7"
          />
        </svg>
        {t("segments.title")}
      </Link>

      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          {segment.color && (
            <span
              className={`inline-flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold ${getSegmentColorClasses(
                segment.color
              )}`}
            >
              {segment.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
              {segment.name}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  segment.segmentType === "Dynamic"
                    ? "bg-purple-100 text-purple-800"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {t(`segments.type.${segment.segmentType.toLowerCase()}`)}
              </span>
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
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
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
            {t("segments.action.export")}
          </button>
          <Link
            href={`/members/segments/${segmentId}/edit`}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700"
          >
            {t("segments.editSegment")}
          </Link>
          {isAdmin &&
            (deleting ? (
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
                className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50"
              >
                {t("common.delete")}
              </button>
            ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Segment Info */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-xl bg-white p-6 shadow-sm md:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            {t("segments.section.details")}
          </h2>
          {segment.description && (
            <p className="mb-4 text-gray-700">{segment.description}</p>
          )}

          {/* Dynamic criteria summary */}
          {segment.segmentType === "Dynamic" && criteria && (
            <div className="mt-4 border-t pt-4">
              <h3 className="mb-2 text-sm font-medium text-gray-700">
                {t("segments.section.criteria")}
              </h3>
              <div className="space-y-2 text-sm">
                {criteria.status && criteria.status.length > 0 && (
                  <p>
                    <span className="font-medium text-gray-600">
                      {t("segments.criteria.status")}:
                    </span>{" "}
                    {criteria.status
                      .map((s) => t(`status.${s.toLowerCase()}`))
                      .join(", ")}
                  </p>
                )}
                {criteria.type && criteria.type.length > 0 && (
                  <p>
                    <span className="font-medium text-gray-600">
                      {t("segments.criteria.type")}:
                    </span>{" "}
                    {criteria.type
                      .map((ty) => t(`membershipType.${ty.toLowerCase()}`))
                      .join(", ")}
                  </p>
                )}
                {(criteria.memberSince?.from || criteria.memberSince?.to) && (
                  <p>
                    <span className="font-medium text-gray-600">
                      {t("segments.criteria.memberSince")}:
                    </span>{" "}
                    {criteria.memberSince?.from &&
                      `${t("segments.from")} ${criteria.memberSince.from}`}
                    {criteria.memberSince?.from &&
                      criteria.memberSince?.to &&
                      " "}
                    {criteria.memberSince?.to &&
                      `${t("segments.to")} ${criteria.memberSince.to}`}
                  </p>
                )}
                {criteria.city && (
                  <p>
                    <span className="font-medium text-gray-600">
                      {t("segments.criteria.city")}:
                    </span>{" "}
                    {criteria.city}
                  </p>
                )}
                {criteria.country && (
                  <p>
                    <span className="font-medium text-gray-600">
                      {t("segments.criteria.country")}:
                    </span>{" "}
                    {criteria.country}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Stats Card */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            {t("segments.section.stats")}
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-500">
                {t("segments.table.members")}
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {segment.memberCount}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">
                {t("segments.field.createdAt")}
              </p>
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
        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            {t("segments.action.addMember")}
          </h2>
          <div className="relative" ref={searchContainerRef}>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder={t("segments.searchMemberPlaceholder")}
                  value={memberSearchQuery}
                  onChange={(e) => handleMemberSearchChange(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                />
                {searchingMembers && (
                  <div className="absolute top-1/2 right-3 -translate-y-1/2">
                    <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-orange-600"></div>
                  </div>
                )}
              </div>
            </div>
            {/* Dropdown */}
            {memberSearchOpen && memberSearchResults.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                {memberSearchResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    disabled={addMutation.isPending}
                    onClick={() => handleAddMember(result.id)}
                    className="w-full border-b border-gray-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-orange-50 disabled:opacity-50"
                  >
                    <p className="text-sm font-medium text-gray-900">
                      {result.firstName} {result.lastName}
                    </p>
                    <p className="text-xs text-gray-500">{result.email}</p>
                  </button>
                ))}
              </div>
            )}
            {memberSearchOpen &&
              memberSearchQuery.length >= 2 &&
              memberSearchResults.length === 0 &&
              !searchingMembers && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
                  <p className="text-center text-sm text-gray-500">
                    {t("segments.noSearchResults")}
                  </p>
                </div>
              )}
          </div>
        </div>
      )}

      {/* Members List */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("segments.section.members")} ({memberCount})
          </h2>
        </div>

        {membersLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-orange-600"></div>
          </div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500">{t("segments.noMembers")}</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  {t("members.table.name")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  {t("members.table.email")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  {t("members.table.type")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  {t("members.table.status")}
                </th>
                {segment.segmentType === "Static" && (
                  <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
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
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        member.status === "Active"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {t(`status.${member.status.toLowerCase()}`)}
                    </span>
                  </td>
                  {segment.segmentType === "Static" && (
                    <td className="px-6 py-4 text-right">
                      {removingMemberId === member.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                          >
                            {t("common.confirm")}
                          </button>
                          <button
                            onClick={() => setRemovingMemberId(null)}
                            className="rounded border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
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
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
            <p className="text-sm text-gray-500">
              {t("common.page")} {memberPage} / {memberTotalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setMemberPage(Math.max(1, memberPage - 1))}
                disabled={memberPage === 1}
                className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                {t("common.previous")}
              </button>
              <button
                onClick={() =>
                  setMemberPage(Math.min(memberTotalPages, memberPage + 1))
                }
                disabled={memberPage === memberTotalPages}
                className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                {t("common.next")}
              </button>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
