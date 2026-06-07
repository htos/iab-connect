"use client";

/**
 * Budget vs Actual (Soll/Ist) Report
 * REQ-044 (E6-S3): per cost center (ActivityArea), budget vs actual net cost for a fiscal period.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth, useApiClient } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import {
  BUDGET_VS_ACTUAL_ENDPOINT,
  BUDGET_VS_ACTUAL_EXPORT_ENDPOINT,
  type BudgetVsActualReport,
} from "@/lib/api/budgets";

interface ActivityAreaOption {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

interface FiscalPeriodOption {
  id: string;
  name: string;
}

export default function BudgetVsActualPage() {
  const t = useTranslations("budgetVsActual");
  const tf = useTranslations("finance");
  const { canReadFinance, isLoading: authLoading } = useAuth();
  const api = useApiClient();

  const apiRef = useRef(api);
  apiRef.current = api;

  const [areas, setAreas] = useState<ActivityAreaOption[]>([]);
  const [periods, setPeriods] = useState<FiscalPeriodOption[]>([]);
  const [periodId, setPeriodId] = useState("");
  const [areaId, setAreaId] = useState("");

  const [report, setReport] = useState<BudgetVsActualReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSelectors = useCallback(async () => {
    const [areaRes, periodRes] = await Promise.all([
      apiRef.current.get<unknown>("/api/v1/finance/activity-areas"),
      apiRef.current.get<unknown>("/api/v1/finance/fiscal-periods"),
    ]);
    if (areaRes.data) {
      const body = areaRes.data as { items?: ActivityAreaOption[] };
      setAreas((body.items ?? []).filter((a) => a.isActive));
    }
    if (periodRes.data) {
      const body = periodRes.data as { items?: FiscalPeriodOption[] };
      setPeriods(body.items ?? []);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && canReadFinance) {
      fetchSelectors();
    }
  }, [authLoading, canReadFinance, fetchSelectors]);

  const handleGenerate = useCallback(async () => {
    if (!periodId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ fiscalPeriodId: periodId });
      if (areaId) params.set("activityAreaId", areaId);
      const res = await apiRef.current.get<BudgetVsActualReport>(
        `${BUDGET_VS_ACTUAL_ENDPOINT}?${params.toString()}`
      );
      if (res.error) throw new Error(res.error);
      setReport(res.data ?? null);
    } catch {
      setError(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [periodId, areaId, t]);

  const handleExport = useCallback(async () => {
    if (!periodId) return;
    setExporting(true);
    setError(null);
    try {
      const params = new URLSearchParams({ fiscalPeriodId: periodId });
      if (areaId) params.set("activityAreaId", areaId);
      const res = await apiRef.current.get(
        `${BUDGET_VS_ACTUAL_EXPORT_ENDPOINT}?${params.toString()}`
      );
      if (res.error) throw new Error(res.error);
      const blob = res.data as Blob;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "budget-vs-actual.csv";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError(t("exportError"));
    } finally {
      setExporting(false);
    }
  }, [periodId, areaId, t]);

  if (authLoading) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 rounded bg-gray-200" />
            <div className="h-64 rounded-xl bg-gray-200" />
          </div>
        </div>
      </main>
    );
  }

  if (!canReadFinance) {
    return null;
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <Link
          href="/finance"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
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
          {tf("backToFinance")}
        </Link>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("subtitle")}</p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Filter bar */}
        <div className="grid grid-cols-1 gap-4 rounded-xl bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("period")} *
            </label>
            <select
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
            >
              <option value="">{t("selectPeriod")}</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("costCenter")}
            </label>
            <select
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
            >
              <option value="">{t("allCostCenters")}</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleGenerate}
              disabled={!periodId || loading}
              className="w-full rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
            >
              {loading ? t("generating") : t("generate")}
            </button>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleExport}
              disabled={!periodId || exporting || !report}
              className="w-full rounded-lg border border-orange-600 px-4 py-2 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-50 disabled:opacity-50"
            >
              {exporting ? t("exporting") : t("exportCsv")}
            </button>
          </div>
        </div>

        {/* Results */}
        {report && (
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-sm font-semibold text-gray-700">
                {t("period")}: {report.fiscalPeriodName}
              </h2>
            </div>
            {report.rows.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-lg font-medium text-gray-900">
                  {t("noData")}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {t("noDataDescription")}
                </p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                      {t("costCenter")}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                      {t("soll")}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                      {t("ist")}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                      {t("variance")}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                      {t("variancePercent")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {report.rows.map((row) => (
                    <tr key={row.activityAreaId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                        <span className="font-mono font-medium">
                          {row.activityAreaCode}
                        </span>
                        {row.activityAreaName
                          ? ` — ${row.activityAreaName}`
                          : ""}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-sm whitespace-nowrap text-gray-900">
                        {formatCurrency(row.budget, row.currency)}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-sm whitespace-nowrap text-gray-900">
                        {formatCurrency(row.actual, row.currency)}
                      </td>
                      <td
                        className={`px-6 py-4 text-right font-mono text-sm whitespace-nowrap ${
                          row.variance < 0 ? "text-red-600" : "text-gray-900"
                        }`}
                      >
                        {formatCurrency(row.variance, row.currency)}
                      </td>
                      <td
                        className={`px-6 py-4 text-right font-mono text-sm whitespace-nowrap ${
                          row.variance < 0 ? "text-red-600" : "text-gray-900"
                        }`}
                      >
                        {row.variancePercent.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
