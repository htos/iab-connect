"use client";

/**
 * Audit events table (E27-S4). Structure + loading/empty rows + the 7 columns are
 * preserved verbatim from the god-page so the E27-S1 net's column/label/badge
 * assertions hold. Severity/category/success badges go through the consolidated
 * feature-local badge helpers (A77) which keep the exact colour classes the net
 * pins. `formatAuditDate` stays the lib helper (the net keeps it real).
 */

import { useTranslations } from "next-intl";
import { formatAuditDate } from "../api/audit";
import {
  AuditCategoryBadge,
  AuditSeverityBadge,
  AuditStatusBadge,
} from "./audit-badges";
import type { AuditEvent } from "../types/audit.types";

interface AuditTableProps {
  events: AuditEvent[];
  isLoading: boolean;
}

export function AuditTable({ events, isLoading }: AuditTableProps) {
  const t = useTranslations("audit");

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                {t("table.timestamp")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                {t("table.category")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                {t("table.eventType")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                {t("table.user")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                {t("table.action")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                {t("table.status")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                {t("table.severity")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center">
                  <div className="flex justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-orange-600"></div>
                  </div>
                </td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  {t("table.noResults")}
                </td>
              </tr>
            ) : (
              events.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-900">
                    {formatAuditDate(event.timestamp)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <AuditCategoryBadge category={event.category} />
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-900">
                    {event.eventType}
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-900">
                    {event.userName || event.userId || "-"}
                  </td>
                  <td
                    className="max-w-xs truncate px-4 py-3 text-sm text-gray-900"
                    title={event.action}
                  >
                    {event.action}
                    {event.entityType && (
                      <span className="ml-1 text-gray-500">
                        ({event.entityType}
                        {event.entityId ? `: ${event.entityId}` : ""})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <AuditStatusBadge
                      success={event.success}
                      label={
                        event.success
                          ? t("status.success")
                          : t("status.failure")
                      }
                      title={event.errorMessage || undefined}
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <AuditSeverityBadge severity={event.severity} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
