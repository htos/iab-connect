"use client";

import { useTranslations } from "next-intl";
import { DeliveryStatusBadge } from "./delivery-status-badge";
import type { WebhookDeliveryDto } from "../types/admin-integrations.types";

/**
 * Webhook-deliveries table (E27-S5). Behaviour-preserving extraction of the god-page
 * metadata-only rows: event / target / status badge / code / attempts / lastAttempt.
 * READ-ONLY: NO filter bar, NO per-row retry action, the payload body is NEVER
 * rendered (AC-2; pinned by S1's no-filter/no-retry/no-combobox/no-textbox
 * assertions). The status badge keeps the RAW server status string as its text.
 */
export function DeliveriesTable({ items }: { items: WebhookDeliveryDto[] }) {
  const t = useTranslations("admin.webhookDeliveries");

  return (
    <table className="w-full overflow-hidden rounded-md border text-sm">
      <thead className="bg-gray-50 text-left">
        <tr>
          <th className="px-4 py-2 font-medium">{t("event")}</th>
          <th className="px-4 py-2 font-medium">{t("target")}</th>
          <th className="px-4 py-2 font-medium">{t("status")}</th>
          <th className="px-4 py-2 font-medium">{t("code")}</th>
          <th className="px-4 py-2 font-medium">{t("attempts")}</th>
          <th className="px-4 py-2 font-medium">{t("lastAttempt")}</th>
        </tr>
      </thead>
      <tbody>
        {items.map((d) => (
          <tr key={d.id} className="border-t">
            <td className="px-4 py-2">{d.eventType}</td>
            <td className="px-4 py-2 break-all text-gray-600">{d.targetUrl}</td>
            <td className="px-4 py-2">
              <DeliveryStatusBadge status={d.status} />
            </td>
            <td className="px-4 py-2">{d.responseStatusCode ?? "—"}</td>
            <td className="px-4 py-2">{d.attemptCount}</td>
            <td className="px-4 py-2 text-gray-500">
              {d.lastAttemptAt
                ? new Date(d.lastAttemptAt).toLocaleString()
                : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
