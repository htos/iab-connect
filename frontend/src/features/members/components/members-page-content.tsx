"use client";

/**
 * Member List Page content — REQ-016: Mitgliederliste. Accessible to Vorstand
 * and Admin only.
 *
 * Feature-slice composition root (E23-S2). The route file `app/members/page.tsx`
 * is a thin server entry that renders this component; this is the single
 * `"use client"` boundary. Data/mutations live in TanStack hooks (`use-members`,
 * `use-member-statistics`, `use-delete-member`); URLs in `api/members-api`.
 *
 * Behaviour preserved verbatim (pinned by the E23-S1 characterization suite):
 * Vorstand/Admin gate + redirects, SERVER-side search/status/type/page (all in
 * the query key), admin-only CSV export + per-row delete, statistics-card gating,
 * pagination bounds, loading/error/empty states, list+statistics refresh after a
 * delete, and the error-banner retry control. Delete now uses an accessible Radix
 * dialog (A79) instead of confirm()/alert(); a failed delete surfaces in the
 * banner taking precedence over a stale list-query error, cleared via
 * `mutation.reset()` on the next filter/search change (the E21 P3 fix).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useApiClient, useAuth } from "@/lib/auth";
import { PageShell, PageHeader } from "@/components/layout";
import { MembershipStatus, MembershipType } from "../types/member.types";
import { exportMembersCsv } from "../api/members-api";
import { useMembers } from "../hooks/use-members";
import { useMemberStatistics } from "../hooks/use-member-statistics";
import { useDeleteMember } from "../hooks/use-delete-member";
import { MembersFilterBar } from "./members-filter-bar";
import { MembersTable } from "./members-table";
import { DeleteMemberDialog } from "./delete-member-dialog";

export function MembersPageContent() {
  const {
    isAuthenticated,
    isLoading: authLoading,
    isVorstand,
    isAdmin,
  } = useAuth();
  const api = useApiClient();
  const router = useRouter();
  const t = useTranslations();

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<MembershipStatus | "">("");
  const [typeFilter, setTypeFilter] = useState<MembershipType | "">("");
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }
    if (!authLoading && isAuthenticated && !isVorstand && !isAdmin) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isVorstand, isAdmin, router]);

  const enabled = isAuthenticated && (isVorstand || isAdmin);

  const {
    data: pageData,
    isLoading: loading,
    error,
    refetch,
  } = useMembers(
    { page, status: statusFilter, type: typeFilter, search: searchTerm },
    enabled
  );
  const { data: statistics } = useMemberStatistics(enabled);
  const deleteMutation = useDeleteMember();

  const members = pageData?.items ?? [];
  const totalPages = pageData?.totalPages ?? 1;
  const totalCount = pageData?.totalCount ?? 0;

  // Delete error takes precedence over a stale list-query error (matches the old
  // god-page, where a failed delete overwrote the banner). The CSV export error
  // is also surfaced here. The mutation error is cleared on the next
  // filter/search interaction below (E21 P3 fix).
  const errorMessage =
    deleteMutation.error?.message ?? exportError ?? error?.message ?? null;

  // Any filter/search interaction clears a stale delete error (P3) + export error.
  const clearTransientErrors = () => {
    if (deleteMutation.error) deleteMutation.reset();
    if (exportError) setExportError(null);
  };

  const handleExportCsv = async () => {
    setExportLoading(true);
    setExportError(null);
    const { data: blob, error: exportErr } = await exportMembersCsv(api);
    if (exportErr || !blob) {
      setExportError(t("members.exportFailed"));
      setExportLoading(false);
      return;
    }
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Mitglieder_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setExportError(t("members.exportFailed"));
    } finally {
      setExportLoading(false);
    }
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSettled: () => setDeleteTarget(null),
    });
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
          <p className="mt-4 text-gray-600">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || (!isVorstand && !isAdmin)) {
    return null; // Will redirect
  }

  return (
    <PageShell
      header={
        <PageHeader
          title={t("members.title")}
          description={t("members.totalMembers", { count: totalCount })}
          actions={
            <div className="flex items-center gap-2">
              {isAdmin && (
                <button
                  onClick={handleExportCsv}
                  disabled={exportLoading}
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
                  {exportLoading ? t("common.loading") : t("members.exportCsv")}
                </button>
              )}
              <Link
                href="/members/new"
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
                {t("members.addMember")}
              </Link>
            </div>
          }
        />
      }
    >
      {/* Statistics Cards */}
      {statistics && (
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="text-2xl font-bold text-green-600">
              {statistics.activeMembers}
            </div>
            <div className="text-sm text-gray-500">
              {t("members.statistics.active")}
            </div>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="text-2xl font-bold text-yellow-600">
              {statistics.pendingMembers}
            </div>
            <div className="text-sm text-gray-500">
              {t("members.statistics.pending")}
            </div>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="text-2xl font-bold text-gray-600">
              {statistics.inactiveMembers}
            </div>
            <div className="text-sm text-gray-500">
              {t("members.statistics.inactive")}
            </div>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="text-2xl font-bold text-red-600">
              {statistics.suspendedMembers}
            </div>
            <div className="text-sm text-gray-500">
              {t("members.statistics.suspended")}
            </div>
          </div>
        </div>
      )}

      <MembersFilterBar
        searchTerm={searchTerm}
        onSearchChange={(value) => {
          clearTransientErrors();
          setSearchTerm(value);
        }}
        onSearchSubmit={() => {
          clearTransientErrors();
          setPage(1);
        }}
        statusFilter={statusFilter}
        onStatusChange={(value) => {
          clearTransientErrors();
          setStatusFilter(value);
          setPage(1);
        }}
        typeFilter={typeFilter}
        onTypeChange={(value) => {
          clearTransientErrors();
          setTypeFilter(value);
          setPage(1);
        }}
      />

      {/* Error State */}
      {errorMessage && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-red-700">{errorMessage}</p>
          <button
            onClick={() => refetch()}
            className="mt-2 text-red-600 underline hover:text-red-800"
          >
            {t("common.tryAgain")}
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-orange-600"></div>
          <p className="mt-4 text-gray-600">{t("common.loadingMembers")}</p>
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
          <svg
            className="mx-auto mb-4 h-16 w-16 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <h3 className="mb-2 text-lg font-medium text-gray-900">
            {t("common.noMembersFound")}
          </h3>
          <p className="text-gray-500">
            {searchTerm || statusFilter || typeFilter
              ? t("common.tryDifferentFilter")
              : t("common.addFirstMember")}
          </p>
        </div>
      ) : (
        <>
          <MembersTable
            members={members}
            onDelete={isAdmin ? setDeleteTarget : undefined}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-gray-700">
                {t("common.page")} {page} {t("common.of")} {totalPages} (
                {totalCount} {t("common.entries")})
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("common.previous")}
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("common.next")}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <DeleteMemberDialog
        target={deleteTarget}
        pending={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      />
    </PageShell>
  );
}
