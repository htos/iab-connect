"use client";

import { useTranslations } from "next-intl";
import { Trash2, Power, Pencil } from "lucide-react";
import { WebhookStatusBadge } from "./webhook-status-badge";
import type { WebhookSubscriptionDto } from "../types/admin-integrations.types";

/**
 * Webhooks table (E27-S5). Behaviour-preserving extraction of the god-page table:
 * name / targetUrl / event chips / status badge / edit-toggle-delete actions.
 *   - Edit (`aria-label={t("edit")}`) opens the shared dialog in edit mode.
 *   - Toggle (Power icon) `aria-label` is `disable` while Active else `enable`; it
 *     fires with NO confirm (god-page parity — only delete is behind window.confirm).
 *   - Delete keeps the red destructive colour verbatim (A86 — `text-red-600
 *     hover:text-red-800`; pinned by S1) and is behind window.confirm in the parent.
 */
export function WebhooksTable({
  subscriptions,
  onEdit,
  onToggle,
  onDelete,
}: {
  subscriptions: WebhookSubscriptionDto[];
  onEdit: (sub: WebhookSubscriptionDto) => void;
  onToggle: (sub: WebhookSubscriptionDto) => void;
  onDelete: (id: string) => void;
}) {
  const t = useTranslations("admin.webhooks");

  return (
    <table className="w-full overflow-hidden rounded-md border text-sm">
      <thead className="bg-gray-50 text-left">
        <tr>
          <th className="px-4 py-2 font-medium">{t("name")}</th>
          <th className="px-4 py-2 font-medium">{t("targetUrl")}</th>
          <th className="px-4 py-2 font-medium">{t("events")}</th>
          <th className="px-4 py-2 font-medium">{t("status")}</th>
          <th className="px-4 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {subscriptions.map((s) => (
          <tr key={s.id} className="border-t">
            <td className="px-4 py-2">{s.name}</td>
            <td className="px-4 py-2 break-all text-gray-600">{s.targetUrl}</td>
            <td className="px-4 py-2">
              <div className="flex flex-wrap gap-1">
                {s.eventTypes.map((e) => (
                  <span
                    key={e}
                    className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs"
                  >
                    {e}
                  </span>
                ))}
              </div>
            </td>
            <td className="px-4 py-2">
              <WebhookStatusBadge status={s.status} />
            </td>
            <td className="px-4 py-2 text-right">
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => onEdit(s)}
                  className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"
                  aria-label={t("edit")}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onToggle(s)}
                  className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"
                  aria-label={
                    s.status === "Active" ? t("disable") : t("enable")
                  }
                >
                  <Power className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDelete(s.id)}
                  className="inline-flex items-center gap-1 text-red-600 hover:text-red-800"
                  aria-label={t("delete")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
