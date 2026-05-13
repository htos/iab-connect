"use client";

/**
 * REQ-018 (E2.S4): Admin/Vorstand-facing duplicate-groups review page.
 *
 * Lists every cross-table duplicate-candidate group with two actions per row:
 *   - Merge (admin-only) → opens MergeConfirmationModal → POST /api/v1/members/{src}/merge-into/{tgt}
 *   - Dismiss (Vorstand+) → opens DismissConfirmationModal → POST /api/v1/members/duplicate-dismissals
 *
 * Refresh discipline (docs/07_dos_donts.md item 13 + Epic-1 retro action item):
 * NO inline fetch in click handlers. After a successful action we bump `refreshKey`,
 * the useEffect re-fetches the page.
 */

import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, AlertOctagon, Loader2 } from "lucide-react";
import {
  getDuplicateGroups,
  dismissDuplicateCandidate,
  mergeMembers,
  type DuplicateGroupDto,
  type MatchTier,
} from "@/lib/api/members";
import { DuplicateGroupRow } from "@/components/members/DuplicateGroupRow";
import { MergeConfirmationModal } from "@/components/members/MergeConfirmationModal";
import { DismissConfirmationModal } from "@/components/members/DismissConfirmationModal";

const DEFAULT_PAGE_SIZE = 20;

export default function DuplicatesPage() {
  const { isAuthenticated, isLoading: authLoading, isVorstand, isAdmin, accessToken } = useAuth();
  const router = useRouter();
  const t = useTranslations();

  const [groups, setGroups] = useState<DuplicateGroupDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [minTier, setMinTier] = useState<MatchTier | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [mergeOpen, setMergeOpen] = useState(false);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<DuplicateGroupDto | null>(null);

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

  // Fetch via refreshKey + queryparams. Wrapped in useCallback so the effect body never
  // calls setState synchronously (react-hooks/set-state-in-effect) — same pattern as
  // [frontend/src/app/members/page.tsx:fetchMembers].
  const fetchGroups = useCallback(
    async (currentPage: number, currentTier: MatchTier | "") => {
      if (!accessToken || (!isVorstand && !isAdmin)) return;
      setLoading(true);
      setError(null);
      try {
        const result = await getDuplicateGroups(accessToken, {
          page: currentPage,
          pageSize: DEFAULT_PAGE_SIZE,
          minTier: currentTier || undefined,
        });
        setGroups(result.items);
        setTotalCount(result.totalCount);
        setTotalPages(result.totalPages);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [accessToken, isVorstand, isAdmin]
  );

  useEffect(() => {
    fetchGroups(page, minTier);
  }, [fetchGroups, page, minTier, refreshKey]);

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
      if (!accessToken) throw new Error("Not authenticated");
      if (!activeGroup) throw new Error("No group selected");
      // REQ-018 review patch (D6): cascade-dismiss every C(N,2) canonical pair so an N-member
      // group disappears in one action. Idempotent dismissals (already-dismissed pairs) return
      // 200 with the existing row, so re-running the same group is safe.
      const ids = activeGroup.members.map((m) => m.id);
      const pairs: Array<{ memberA: string; memberB: string }> = [];
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          pairs.push({ memberA: ids[i], memberB: ids[j] });
        }
      }
      await Promise.all(
        pairs.map((p) =>
          dismissDuplicateCandidate(accessToken, {
            memberA: p.memberA,
            memberB: p.memberB,
            reason,
          })
        )
      );
      // Refresh discipline: bump refreshKey instead of chaining fetches in the handler.
      setRefreshKey((k) => k + 1);
    },
    [accessToken, activeGroup]
  );

  const handleMergeConfirm = useCallback(
    async (
      sourceId: string,
      targetId: string,
      reason: string,
      confirmFinanceImpact: boolean,
      confirmKeycloakImpact: boolean
    ) => {
      if (!accessToken) throw new Error("Not authenticated");
      await mergeMembers(accessToken, {
        sourceId,
        targetId,
        reason,
        confirmFinanceImpact,
        confirmKeycloakImpact,
      });
      setRefreshKey((k) => k + 1);
    },
    [accessToken]
  );

  if (authLoading || (!isAuthenticated && !authLoading)) {
    return null;
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {t("members.duplicates.title")}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {t("members.duplicates.subtitle")}
          </p>
        </header>

        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <span>{t("members.duplicates.filter.tierLabel")}</span>
            <select
              value={minTier}
              onChange={(e) => {
                setMinTier(e.target.value as MatchTier | "");
                setPage(1);
              }}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              data-testid="duplicates-tier-filter"
            >
              <option value="">{t("members.duplicates.filter.all")}</option>
              <option value="Exact">{t("members.duplicates.filter.exact")}</option>
              <option value="Likely">{t("members.duplicates.filter.likely")}</option>
            </select>
          </label>

          <span className="text-sm text-gray-500">
            {t("members.duplicates.totalCount", { count: totalCount })}
          </span>
        </div>

        {loading && (
          <div
            className="flex items-center gap-2 text-gray-600 p-6 bg-white border border-gray-200 rounded-xl"
            data-testid="duplicates-loading"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            {t("members.duplicates.loading")}
          </div>
        )}

        {!loading && error && (
          <div
            role="alert"
            className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-xl p-4"
            data-testid="duplicates-error"
          >
            <AlertOctagon className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-orange-800">
                {t("members.duplicates.error.title")}
              </p>
              <p className="text-sm text-orange-700 mt-1">{error}</p>
              <button
                type="button"
                onClick={() => setRefreshKey((k) => k + 1)}
                className="mt-2 inline-flex items-center rounded-lg border border-orange-300 bg-white px-3 py-1.5 text-sm font-medium text-orange-700 hover:bg-orange-100"
              >
                {t("members.duplicates.error.retry")}
              </button>
            </div>
          </div>
        )}

        {!loading && !error && groups.length === 0 && (
          <div
            className="flex flex-col items-center gap-2 p-10 bg-white border border-gray-200 rounded-xl text-center"
            data-testid="duplicates-empty"
          >
            <CheckCircle2 className="w-10 h-10 text-green-600" />
            <p className="text-lg font-semibold text-gray-800">
              {t("members.duplicates.empty.title")}
            </p>
            <p className="text-sm text-gray-600">
              {t("members.duplicates.empty.message")}
            </p>
          </div>
        )}

        {!loading && !error && groups.length > 0 && (
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

        {!loading && !error && totalPages > 1 && (
          <nav className="mt-6 flex items-center justify-between" aria-label="pagination">
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
      </div>

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
    </main>
  );
}
