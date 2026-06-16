"use client";

/**
 * Health status cards (E27-S4). Overall status card (inline dot + badge + total
 * duration) + per-service cards (name + status badge + duration + exception box).
 * Structure preserved verbatim from the god-page; the dot + badge colours go
 * through the consolidated `health-badges` helpers (A77) which keep the exact
 * classes the E27-S1 health net pins.
 */

import { useTranslations } from "next-intl";
import {
  HealthStatusBadge,
  healthDotClass,
  healthStatusClass,
} from "./health-badges";
import type { HealthDetailResponse } from "../types/health.types";

export function HealthStatus({ health }: { health: HealthDetailResponse }) {
  const t = useTranslations("admin.health");

  return (
    <>
      {/* Overall Status Card */}
      <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`h-4 w-4 rounded-full ${healthDotClass(health.status)}`}
            />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {t("overallStatus")}
              </h2>
              <span
                className={`mt-1 inline-block rounded-full px-3 py-1 text-sm font-medium ${healthStatusClass(health.status)}`}
              >
                {health.status}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">{t("totalDuration")}</p>
            <p className="font-mono text-lg text-gray-900">
              {health.totalDuration.toFixed(1)} ms
            </p>
          </div>
        </div>
      </div>

      {/* Service Health Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {health.entries.map((entry) => (
          <div key={entry.name} className="rounded-xl bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900 capitalize">
                {entry.name}
              </h3>
              <HealthStatusBadge
                status={entry.status}
                className="rounded-full px-2.5 py-0.5 text-xs font-medium"
              />
            </div>
            {entry.description && (
              <p className="mb-2 text-sm text-gray-600">{entry.description}</p>
            )}
            <div className="font-mono text-xs text-gray-400">
              {entry.duration.toFixed(1)} ms
            </div>
            {entry.exception && (
              <div className="mt-3 rounded-lg bg-red-50 p-2 font-mono text-xs break-all text-red-600">
                {entry.exception}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
