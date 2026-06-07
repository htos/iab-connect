"use client";

/**
 * REQ-028 (E5-S3): automation detail — status badge, status-conditional lifecycle buttons
 * (Activate/Pause/Resume/Disable), and the recent-execution panel from S2's rows.
 */

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import {
  AutomationDetailDto,
  AutomationExecutionDto,
  changeAutomationStatus,
  getAutomation,
  getExecutions,
  getStatusColor,
  getTriggerLabel,
} from "@/lib/api/automations";

export default function AutomationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("automations");
  const { accessToken, isVorstand, isAdmin } = useAuth();

  const [automation, setAutomation] = useState<AutomationDetailDto | null>(
    null
  );
  const [executions, setExecutions] = useState<AutomationExecutionDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const a = await getAutomation(accessToken, id);
      setAutomation(a);
      try {
        setExecutions(await getExecutions(accessToken, id));
      } catch {
        setExecutions([]); // degrade gracefully to "no runs yet"
      }
    } catch {
      setError(t("loadError"));
    }
  }, [accessToken, id, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(action: "activate" | "pause" | "resume" | "disable") {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await changeAutomationStatus(accessToken, id, action);
      setAutomation(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  if (error && !automation) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
        <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      </main>
    );
  }

  if (!automation) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
      </div>
    );
  }

  const canEdit =
    (isVorstand || isAdmin) &&
    (automation.status === "Draft" || automation.status === "Paused");
  const status = automation.status;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4">
          <Link
            href="/communication/automations"
            className="text-sm text-orange-600 hover:underline"
          >
            ← {t("backToList")}
          </Link>
        </div>

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
              {automation.name}
            </h1>
            {automation.description && (
              <p className="mt-1 text-gray-600">{automation.description}</p>
            )}
          </div>
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(status)}`}
          >
            {t(`status${status}`)}
          </span>
        </div>

        {error && (
          <div
            className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="mb-6 space-y-2 rounded-xl bg-white p-6 text-sm shadow-sm">
          <div>
            <span className="font-medium text-gray-700">
              {t("table.trigger")}:{" "}
            </span>
            {getTriggerLabel(automation.trigger, t)}
          </div>
          <div>
            <span className="font-medium text-gray-700">
              {t("table.template")}:{" "}
            </span>
            {automation.templateName ?? `#${automation.templateId}`}
          </div>
          <div>
            <span className="font-medium text-gray-700">
              {t("form.recipients")}:{" "}
            </span>
            {t(`segment.${automation.segmentType}`)}
            {automation.consentFilter
              ? ` · ${t(`consent.${automation.consentFilter}`)}`
              : ""}
          </div>
        </div>

        {/* Lifecycle actions */}
        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            {t("actions")}
          </h2>
          <div className="flex flex-wrap gap-3">
            {(status === "Draft" || status === "Disabled") && (
              <button
                onClick={() => act("activate")}
                disabled={busy}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
              >
                {t("activate")}
              </button>
            )}
            {status === "Active" && (
              <button
                onClick={() => act("pause")}
                disabled={busy}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                {t("pause")}
              </button>
            )}
            {status === "Paused" && (
              <button
                onClick={() => act("resume")}
                disabled={busy}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
              >
                {t("resume")}
              </button>
            )}
            {status !== "Disabled" && (
              <button
                onClick={() => act("disable")}
                disabled={busy}
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                {t("disable")}
              </button>
            )}
            {canEdit && (
              <Link
                href={`/communication/automations/${automation.id}/edit`}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                {t("edit")}
              </Link>
            )}
          </div>
        </div>

        {/* Recent executions */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            {t("recentRuns")}
          </h2>
          {executions.length === 0 ? (
            <p className="text-sm text-gray-500">{t("noRunsYet")}</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase">
                  <th className="py-2 pr-4">{t("run.startedAt")}</th>
                  <th className="py-2 pr-4">{t("status")}</th>
                  <th className="py-2 pr-4">{t("run.sent")}</th>
                  <th className="py-2 pr-4">{t("run.failed")}</th>
                  <th className="py-2 pr-4">{t("run.skipped")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {executions.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2 pr-4">
                      {new Date(e.startedAt).toLocaleString("de-CH")}
                    </td>
                    <td className="py-2 pr-4">{e.status}</td>
                    <td className="py-2 pr-4 text-green-700">{e.sentCount}</td>
                    <td className="py-2 pr-4 text-red-700">{e.failedCount}</td>
                    <td className="py-2 pr-4 text-gray-500">
                      {e.skippedCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
