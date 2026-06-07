"use client";

/**
 * REQ-028 (E5-S3): Automation (journey) list. Vorstand/Admin only. Mirrors the email-campaigns
 * list shape: header + "New" button, search + status filter, paged table, refreshKey refresh.
 */

import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  AutomationListItemDto,
  AutomationStatus,
  getStatusColor,
  getTriggerLabel,
  listAutomations,
} from "@/lib/api/automations";

export default function AutomationsPage() {
  const t = useTranslations("automations");
  const {
    isAuthenticated,
    isLoading: authLoading,
    isVorstand,
    isAdmin,
    accessToken,
  } = useAuth();
  const router = useRouter();

  const [automations, setAutomations] = useState<AutomationListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<AutomationStatus | "">("");
  const [searchTerm, setSearchTerm] = useState("");

  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;

  const fetchAutomations = useCallback(
    async (currentPage: number, status: string) => {
      const token = accessTokenRef.current;
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const data = await listAutomations(token, {
          page: currentPage,
          pageSize: 10,
          status: status || undefined,
        });
        setAutomations(data.items);
        setTotalPages(data.totalPages);
        setTotalCount(data.totalCount);
      } catch {
        setError(t("loadError"));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
    if (!authLoading && isAuthenticated && !isVorstand && !isAdmin)
      router.push("/");
  }, [authLoading, isAuthenticated, isVorstand, isAdmin, router]);

  useEffect(() => {
    if (accessToken && (isVorstand || isAdmin)) {
      fetchAutomations(page, statusFilter);
    }
  }, [accessToken, isVorstand, isAdmin, page, statusFilter, fetchAutomations]);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return automations;
    const term = searchTerm.toLowerCase();
    return automations.filter(
      (a) =>
        a.name.toLowerCase().includes(term) ||
        (a.templateName ?? "").toLowerCase().includes(term)
    );
  }, [automations, searchTerm]);

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

        <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder={t("search")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-4 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("status")}
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as AutomationStatus | "");
                  setPage(1);
                }}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
              >
                <option value="">{t("allStatuses")}</option>
                <option value="Draft">{t("statusDraft")}</option>
                <option value="Active">{t("statusActive")}</option>
                <option value="Paused">{t("statusPaused")}</option>
                <option value="Disabled">{t("statusDisabled")}</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  {t("table.name")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  {t("status")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  {t("table.trigger")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  {t("table.template")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  {t("table.created")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    {t("noAutomationsFound")}
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link
                        href={`/communication/automations/${a.id}`}
                        className="font-medium text-orange-600 hover:underline"
                      >
                        {a.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(a.status)}`}
                      >
                        {t(`status${a.status}`)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {getTriggerLabel(a.trigger, t)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {a.templateName ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div>
                        {new Date(a.createdAt).toLocaleDateString("de-CH", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </div>
                      <div className="text-xs">{a.createdByName}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

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
