"use client";

import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { ApiClientStatusBadge } from "./api-client-status-badge";
import type { ApiClientDto } from "../types/admin-integrations.types";

/**
 * Api-clients table (E27-S5). Behaviour-preserving extraction of the god-page table:
 * name / scopes (chips) / status badge / lastUsed / revoke. Revoke is shown ONLY on
 * a non-revoked client (`!isRevoked`) and keeps the red destructive colour verbatim
 * (A86 — `text-red-600 hover:text-red-800`, NOT a generic destructive variant; pinned
 * by S1). The confirm gate + transport live in the parent (DEC-3 = A).
 */
export function ApiClientsTable({
  clients,
  onRevoke,
}: {
  clients: ApiClientDto[];
  onRevoke: (id: string) => void;
}) {
  const t = useTranslations("admin.apiClients");

  return (
    <table className="w-full overflow-hidden rounded-md border text-sm">
      <thead className="bg-gray-50 text-left">
        <tr>
          <th className="px-4 py-2 font-medium">{t("name")}</th>
          <th className="px-4 py-2 font-medium">{t("scopes")}</th>
          <th className="px-4 py-2 font-medium">{t("status")}</th>
          <th className="px-4 py-2 font-medium">{t("lastUsed")}</th>
          <th className="px-4 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {clients.map((c) => (
          <tr key={c.id} className="border-t">
            <td className="px-4 py-2">{c.name}</td>
            <td className="px-4 py-2">
              <div className="flex flex-wrap gap-1">
                {c.scopes.map((s) => (
                  <span
                    key={s}
                    className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </td>
            <td className="px-4 py-2">
              <ApiClientStatusBadge isRevoked={c.isRevoked} />
            </td>
            <td className="px-4 py-2 text-gray-500">
              {c.lastUsedAt
                ? new Date(c.lastUsedAt).toLocaleString()
                : t("never")}
            </td>
            <td className="px-4 py-2 text-right">
              {!c.isRevoked && (
                <button
                  onClick={() => onRevoke(c.id)}
                  className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-4 w-4" /> {t("revoke")}
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
