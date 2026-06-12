import Link from "next/link";
import { useTranslations } from "next-intl";
import { getTriggerLabel } from "@/lib/api/automations";
import { AutomationStatusBadge } from "./automation-status-badge";
import type { AutomationListItemDto } from "../types/automation.types";

interface AutomationsTableProps {
  automations: AutomationListItemDto[];
}

// Automations list table. Markup preserved from the god-page: name → detail link,
// status badge (now the shared Badge primitive — DEC-4), trigger label via the
// boundary-legal `getTriggerLabel(t)` lib helper, templateName, and the
// created date/author. Empty state spans the columns (`noAutomationsFound`).
export function AutomationsTable({ automations }: AutomationsTableProps) {
  const t = useTranslations("automations");
  return (
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
          {automations.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                {t("noAutomationsFound")}
              </td>
            </tr>
          ) : (
            automations.map((a) => (
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
                  <AutomationStatusBadge status={a.status} />
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
  );
}
