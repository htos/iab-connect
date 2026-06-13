"use client";

/**
 * REQ-018 (E2.S4): Admin/Vorstand-facing duplicate-groups review page.
 *
 * Lists every cross-table duplicate-candidate group with two actions per row:
 *   - Merge (admin-only) → opens MergeConfirmationModal → POST /api/v1/members/{src}/merge-into/{tgt}
 *   - Dismiss (Vorstand+) → opens DismissConfirmationModal → POST /api/v1/members/duplicate-dismissals
 *
 * E23-S3 feature-slice migration: data now flows through TanStack Query
 * (useDuplicateGroups / useMergeMembers / useDismissDuplicates) instead of the
 * god-page's manual fetch/refreshKey/useCallback dance. A successful merge/dismiss
 * invalidates the duplicate-groups query (refetch), and the error-state retry
 * button calls the query's refetch(). Behaviour is otherwise preserved verbatim,
 * including the C(N,2) cascade-dismiss (one POST per canonical pair).
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, AlertOctagon, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/layout";
import type { DuplicateGroupDto, MatchTier } from "../api/member-duplicates";
import { useDuplicateGroups } from "../hooks/use-duplicate-groups";
import { useMergeMembers } from "../hooks/use-merge-members";
import { useDismissDuplicates } from "../hooks/use-dismiss-duplicates";
import { DuplicateGroupRow } from "./duplicate-group-row";
import { MergeConfirmationModal } from "./merge-confirmation-modal";
import { DismissConfirmationModal } from "./dismiss-confirmation-modal";

export function DuplicatesPageContent() {
  const {
    isAuthenticated,
    isLoading: authLoading,
    isVorstand,
    isAdmin,
  } = useAuth();
  const router = useRouter();
  const t = useTranslations();

  const [page, setPage] = useState(1);
  const [minTier, setMinTier] = useState<MatchTier | "">("");

  const [mergeOpen, setMergeOpen] = useState(false);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<DuplicateGroupDto | null>(
    null
  );

  // Auth gate — mirror /members/new pattern: redirect non-Vorstand-non-Admin to "/".
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

  // Data via TanStack. `enabled` mirrors the god-page's `accessToken && (Vorstand||Admin)`
  // fetch gate so no request fires for the unauthorized.
  const enabled = isAuthenticated && (isVorstand || isAdmin);
  const { data, isLoading, isError, error, refetch } = useDuplicateGroups(
    page,
    minTier,
    enabled
  );

  const groups = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 0;

  const mergeMutation = useMergeMembers();
  const dismissMutation = useDismissDuplicates();

  const handleMerge = useCallback((group: DuplicateGroupDto) => {
    setActiveGroup(group);
    setMergeOpen(true);
  }, []);

  const handleDismiss = useCallback((group: DuplicateGroupDto) => {
    setActiveGroup(group);
    setDismissOpen(true);
  }, []);

  const handleDismissConfirm = useCallback(
    async (reason: string) => {
      if (!activeGroup) throw new Error("No group selected");
      // REQ-018 review patch (D6): cascade-dismiss every C(N,2) canonical pair so an N-member
      // group disappears in one action. Idempotent dismissals (already-dismissed pairs) return
      // 200 with the existing row, so re-running the same group is safe. Let it throw so the
      // modal's catch shows the error; onSuccess invalidation refetches the page.
      await dismissMutation.mutateAsync({
        memberIds: activeGroup.members.map((m) => m.id),
        reason,
      });
    },
    [activeGroup, dismissMutation]
  );

  const handleMergeConfirm = useCallback(
    async (
      sourceId: string,
      targetId: string,
      reason: string,
      confirmFinanceImpact: boolean,
      confirmKeycloakImpact: boolean
    ) => {
      // Let it throw so the merge modal's catch shows the error; onSuccess
      // invalidation refetches the page.
      await mergeMutation.mutateAsync({
        sourceId,
        targetId,
        reason,
        confirmFinanceImpact,
        confirmKeycloakImpact,
      });
    },
    [mergeMutation]
  );

  if (authLoading || (!isAuthenticated && !authLoading)) {
    return null;
  }

  const loading = isLoading && enabled;
  const errorMessage = isError
    ? error instanceof Error
      ? error.message
      : String(error)
    : null;

  return (
    <PageShell>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
          {t("members.duplicates.title")}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {t("members.duplicates.subtitle")}
        </p>
      </header>

      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <span>{t("members.duplicates.filter.tierLabel")}</span>
          <select
            value={minTier}
            onChange={(e) => {
              setMinTier(e.target.value as MatchTier | "");
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
            data-testid="duplicates-tier-filter"
          >
            <option value="">{t("members.duplicates.filter.all")}</option>
            <option value="Exact">
              {t("members.duplicates.filter.exact")}
            </option>
            <option value="Likely">
              {t("members.duplicates.filter.likely")}
            </option>
          </select>
        </label>

        <span className="text-sm text-gray-500">
          {t("members.duplicates.totalCount", { count: totalCount })}
        </span>
      </div>

      {loading && (
        <div
          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-6 text-gray-600"
          data-testid="duplicates-loading"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("members.duplicates.loading")}
        </div>
      )}

      {!loading && errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 p-4"
          data-testid="duplicates-error"
        >
          <AlertOctagon className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
          <div className="flex-1">
            <p className="font-semibold text-orange-800">
              {t("members.duplicates.error.title")}
            </p>
            <p className="mt-1 text-sm text-orange-700">{errorMessage}</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-2 inline-flex items-center rounded-lg border border-orange-300 bg-white px-3 py-1.5 text-sm font-medium text-orange-700 hover:bg-orange-100"
            >
              {t("members.duplicates.error.retry")}
            </button>
          </div>
        </div>
      )}

      {!loading && !errorMessage && groups.length === 0 && (
        <div
          className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-10 text-center"
          data-testid="duplicates-empty"
        >
          <CheckCircle2 className="h-10 w-10 text-green-600" />
          <p className="text-lg font-semibold text-gray-800">
            {t("members.duplicates.empty.title")}
          </p>
          <p className="text-sm text-gray-600">
            {t("members.duplicates.empty.message")}
          </p>
        </div>
      )}

      {!loading && !errorMessage && groups.length > 0 && (
        <ul className="space-y-3" data-testid="duplicates-list">
          {groups.map((group) => (
            <li key={group.groupKey}>
              <DuplicateGroupRow
                group={group}
                isAdmin={isAdmin}
                onMerge={handleMerge}
                onDismiss={handleDismiss}
              />
            </li>
          ))}
        </ul>
      )}

      {!loading && !errorMessage && totalPages > 1 && (
        <nav
          className="mt-6 flex items-center justify-between"
          aria-label="pagination"
        >
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {t("members.duplicates.pagination.prev")}
          </button>
          <span className="text-sm text-gray-600">
            {t("members.duplicates.pagination.pageOf", {
              page,
              totalPages,
            })}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {t("members.duplicates.pagination.next")}
          </button>
        </nav>
      )}

      <MergeConfirmationModal
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        group={activeGroup}
        onConfirm={handleMergeConfirm}
      />
      <DismissConfirmationModal
        open={dismissOpen}
        onOpenChange={setDismissOpen}
        group={activeGroup}
        onConfirm={handleDismissConfirm}
      />
    </PageShell>
  );
}
