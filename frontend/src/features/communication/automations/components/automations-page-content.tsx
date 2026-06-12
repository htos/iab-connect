"use client";

/**
 * Automations List page content (E25-S2). Feature-slice composition root mirroring
 * the sponsors pilot: the route file is a thin server entry rendering this
 * component; this is the single `"use client"` boundary. Data lives in the
 * `use-automations` TanStack hook; URLs in `api/automations-api`.
 *
 * Behaviour preserved verbatim (pinned by the E25-S1 list characterization
 * suite): the auth redirects (`/login` unauth, `/` non-privileged), the
 * Vorstand||Admin gate, the server `status` filter that resets page→1, the
 * client-side search via `useMemo` over name/templateName (no refetch), the
 * loading/error/empty states, the status badge + trigger label, and pagination
 * only when `totalPages > 1`.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { useAutomations } from "../hooks/use-automations";
import { AutomationsFilterBar } from "./automations-filter-bar";
import { AutomationsTable } from "./automations-table";
import type { AutomationStatus } from "../types/automation.types";

export function AutomationsPageContent() {
  const t = useTranslations("automations");
  const {
    isAuthenticated,
    isLoading: authLoading,
    isVorstand,
    isAdmin,
  } = useAuth();
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<AutomationStatus | "">("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
    if (!authLoading && isAuthenticated && !isVorstand && !isAdmin)
      router.push("/");
  }, [authLoading, isAuthenticated, isVorstand, isAdmin, router]);

  const {
    data,
    isLoading: loading,
    error,
  } = useAutomations(
    { page, pageSize: 10, status: statusFilter || undefined },
    isAuthenticated && (isVorstand || isAdmin)
  );

  const items = data?.items;
  const totalPages = data?.totalPages ?? 1;
  const totalCount = data?.totalCount ?? 0;

  const filtered = useMemo(() => {
    const automations = items ?? [];
    if (!searchTerm.trim()) return automations;
    const term = searchTerm.toLowerCase();
    return automations.filter(
      (a) =>
        a.name.toLowerCase().includes(term) ||
        (a.templateName ?? "").toLowerCase().includes(term)
    );
  }, [items, searchTerm]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
          <p className="mt-4 text-gray-600">{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (!isVorstand && !isAdmin) return null;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
              {t("title")}
            </h1>
            <p className="mt-1 text-gray-600">
              {t("totalAutomations", { count: totalCount })}
            </p>
          </div>
          <Link
            href="/communication/automations/new"
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700"
          >
            {t("newAutomation")}
          </Link>
        </div>

        <AutomationsFilterBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          statusFilter={statusFilter}
          onStatusChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
        />

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {t("loadError")}
          </div>
        )}

        <AutomationsTable automations={filtered} />

        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("previous")}
            </button>
            <span className="text-gray-600">
              {t("pagination", { current: page, total: totalPages })}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("next")}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
