"use client";

/**
 * System Health page content (E27-S4). Feature-slice composition root; the route
 * file is a thin entry rendering this — the single `"use client"` boundary.
 *
 * Behaviour preserved verbatim (pinned by the E27-S1 health net): the admin auth
 * guard (non-admin → `router.push("/")` + `return null`; fetch gated on
 * `isAuthenticated && isAdmin && accessToken`), the overall + per-service cards,
 * the exception box, the status badges/dots, `lastChecked`, the manual refresh
 * button, and the 30-second auto-refresh — now a TanStack `refetchInterval:
 * 30_000` (DEC-3 = A) instead of `setInterval`, preserving the exact cadence the
 * net's fake-timer test pins. `lastChecked` is derived from the query's
 * `dataUpdatedAt` (set after each successful fetch).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { useHealth } from "../hooks/use-health";
import { HealthStatus } from "./health-status";

export function HealthPageContent() {
  const t = useTranslations("admin.health");
  const router = useRouter();
  const { isAuthenticated, isLoading, isAdmin, accessToken } = useAuth();

  const gated = Boolean(isAuthenticated && isAdmin && accessToken);
  const { data: health, isError, dataUpdatedAt, refetch } = useHealth(gated);

  // Explicit manual-refresh busy flag (god-page parity: the `loading`-while-
  // refreshing label tracked only the explicit refresh action, NOT the background
  // 30s interval refetch — which silently updated the cards). Keyed off the manual
  // click so the button only reads `refreshing` for a user-triggered refetch.
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/");
    }
  }, [isLoading, isAuthenticated, isAdmin, router]);

  if (isLoading) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex min-h-100 items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated || !isAdmin) return null;

  // `dataUpdatedAt` is 0 until the first successful fetch (god-page parity: the
  // header `lastChecked` only renders after a successful fetch).
  const lastChecked = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
              {t("title")}
            </h1>
            <p className="mt-1 text-gray-600">{t("subtitle")}</p>
          </div>
          <div className="flex items-center gap-3">
            {lastChecked && (
              <span className="text-sm text-gray-500">
                {t("lastChecked")}: {lastChecked.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="rounded-xl bg-orange-600 px-4 py-2 text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
            >
              {isRefreshing ? t("refreshing") : t("refresh")}
            </button>
          </div>
        </div>

        {isError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {t("fetchError")}
          </div>
        )}

        {health && <HealthStatus health={health} />}

        {/* Info Banner */}
        <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-700">{t("autoRefreshInfo")}</p>
        </div>
      </div>
    </main>
  );
}
