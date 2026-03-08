"use client";

/**
 * System Health Monitoring Page
 * REQ-054: Logging & Monitoring
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import {
  getHealthDetail,
  getStatusColor,
  type HealthDetailResponse,
} from "@/lib/api/health";

export default function HealthPage() {
  const t = useTranslations("admin.health");
  const router = useRouter();
  const { isAuthenticated, isLoading, isAdmin, accessToken } = useAuth();

  const [health, setHealth] = useState<HealthDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getHealthDetail(accessToken);
      setHealth(data);
      setLastChecked(new Date());
    } catch {
      setError(t("fetchError"));
    } finally {
      setLoading(false);
    }
  }, [accessToken, t]);

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/");
    }
  }, [isLoading, isAuthenticated, isAdmin, router]);

  useEffect(() => {
    if (isAuthenticated && isAdmin && accessToken) {
      fetchHealth();
    }
  }, [isAuthenticated, isAdmin, accessToken, fetchHealth]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!isAuthenticated || !isAdmin || !accessToken) return;
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, isAdmin, accessToken, fetchHealth]);

  if (isLoading) {
    return (
      <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-100">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated || !isAdmin) return null;

  const overallStatusColor = health
    ? getStatusColor(health.status)
    : "text-gray-700 bg-gray-100";

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              {t("title")}
            </h1>
            <p className="text-gray-600 mt-1">{t("subtitle")}</p>
          </div>
          <div className="flex items-center gap-3">
            {lastChecked && (
              <span className="text-sm text-gray-500">
                {t("lastChecked")}: {lastChecked.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchHealth}
              disabled={loading}
              className="px-4 py-2 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              {loading ? t("refreshing") : t("refresh")}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
            {error}
          </div>
        )}

        {/* Overall Status Card */}
        {health && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={`w-4 h-4 rounded-full ${
                    health.status === "Healthy"
                      ? "bg-green-500"
                      : health.status === "Degraded"
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  }`}
                />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {t("overallStatus")}
                  </h2>
                  <span
                    className={`inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium ${overallStatusColor}`}
                  >
                    {health.status}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">{t("totalDuration")}</p>
                <p className="text-lg font-mono text-gray-900">
                  {health.totalDuration.toFixed(1)} ms
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Service Health Cards */}
        {health && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {health.entries.map((entry) => (
              <div
                key={entry.name}
                className="bg-white rounded-xl shadow-sm p-6"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-gray-900 capitalize">
                    {entry.name}
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(entry.status)}`}
                  >
                    {entry.status}
                  </span>
                </div>
                {entry.description && (
                  <p className="text-sm text-gray-600 mb-2">
                    {entry.description}
                  </p>
                )}
                <div className="text-xs text-gray-400 font-mono">
                  {entry.duration.toFixed(1)} ms
                </div>
                {entry.exception && (
                  <div className="mt-3 p-2 bg-red-50 rounded-lg text-xs text-red-600 font-mono break-all">
                    {entry.exception}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Info Banner */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-700">{t("autoRefreshInfo")}</p>
        </div>
      </div>
    </main>
  );
}
