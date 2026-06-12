"use client";

/**
 * Automation detail page content (E25-S2). Rendered by `[id]/page.tsx` with the
 * `id` resolved from `use(params)`. Loads the automation (retry:false — god-page
 * parity) + its recent executions (degrades to `[]` → `noRunsYet`), renders the
 * status badge, the status-conditional lifecycle action matrix, the canEdit-gated
 * Edit link, and the executions table.
 *
 * Behaviour-preserving (A79): the action matrix matches the god-page exactly —
 * Activate for Draft|Disabled, Pause for Active, Resume for Paused, Disable unless
 * Disabled, Edit link only when `(isVorstand||isAdmin) && (Draft||Paused)`. The
 * lifecycle mutation updates the detail view (writes the returned DTO into the
 * detail cache) and surfaces its error in the banner.
 */

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { getTriggerLabel } from "@/lib/api/automations";
import { AutomationStatusBadge } from "./automation-status-badge";
import { useAutomation } from "../hooks/use-automation";
import { useAutomationExecutions } from "../hooks/use-automation-executions";
import { useAutomationLifecycle } from "../hooks/use-automation-lifecycle";

export function AutomationDetail({ id }: { id: string }) {
  const t = useTranslations("automations");
  const { isAuthenticated, isVorstand, isAdmin, accessToken } = useAuth();
  // Gate the FETCH on the token only (god-page parity): a non-privileged authed
  // user direct-navving still fetches and gets a backend 403 → error panel. The
  // role check is the ACTION gate (`canEdit` below), not the fetch gate — a
  // role-gated `enabled=false` would never run the query, falling through to a
  // permanent spinner instead of the error surface.
  const enabled = isAuthenticated && !!accessToken;

  const { data: automation, isError } = useAutomation(id, enabled);
  const { data: executions = [] } = useAutomationExecutions(id, enabled);
  const lifecycle = useAutomationLifecycle(id);

  if (isError && !automation) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
        <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {t("loadError")}
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

  const status = automation.status;
  const canEdit =
    (isVorstand || isAdmin) && (status === "Draft" || status === "Paused");
  const busy = lifecycle.isPending;
  const lifecycleError = lifecycle.error?.message ?? null;

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
          <AutomationStatusBadge status={status} />
        </div>

        {lifecycleError && (
          <div
            className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
            role="alert"
          >
            {lifecycleError}
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
                onClick={() => lifecycle.mutate("activate")}
                disabled={busy}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
              >
                {t("activate")}
              </button>
            )}
            {status === "Active" && (
              <button
                onClick={() => lifecycle.mutate("pause")}
                disabled={busy}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                {t("pause")}
              </button>
            )}
            {status === "Paused" && (
              <button
                onClick={() => lifecycle.mutate("resume")}
                disabled={busy}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
              >
                {t("resume")}
              </button>
            )}
            {status !== "Disabled" && (
              <button
                onClick={() => lifecycle.mutate("disable")}
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
