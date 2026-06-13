"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { CreateApiClientRequest } from "../types/admin-integrations.types";

/**
 * Create-api-client dialog (E27-S5). Behaviour-preserving extraction of the god-page
 * create dialog: the name input, the scope checkboxes (toggle in/out of the
 * selection), and the Cancel / Save buttons. Save stays disabled unless
 * `!saving && name.trim() && selectedScopes.length >= 1` (validation parity). The
 * god-page used plain `useState` here (NO Zod schema was mandated for this dialog —
 * only the webhook dialog is RHF+Zod), so it stays `useState`-based to preserve the
 * markup + the live save-disabled gate exactly. `t("save")` = "Create" (the api-clients
 * label divergence from webhooks' "Save" — preserved).
 */
export function CreateApiClientDialog({
  availableScopes,
  saving,
  onCancel,
  onCreate,
}: {
  availableScopes: string[];
  saving: boolean;
  onCancel: () => void;
  onCreate: (body: CreateApiClientRequest) => void;
}) {
  const t = useTranslations("admin.apiClients");
  const tCommon = useTranslations("common");

  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">{t("createDialogTitle")}</h2>

        <label className="mb-1 block text-sm font-medium">{t("name")}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-4 w-full rounded-md border px-3 py-2 text-sm"
          placeholder={t("namePlaceholder")}
        />

        <label className="mb-2 block text-sm font-medium">{t("scopes")}</label>
        <div className="mb-4 space-y-2">
          {availableScopes.map((scope) => (
            <label key={scope} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedScopes.includes(scope)}
                onChange={() => toggleScope(scope)}
              />
              <code>{scope}</code>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border px-4 py-2 text-sm"
          >
            {tCommon("cancel")}
          </button>
          <button
            onClick={() => onCreate({ name, scopes: selectedScopes })}
            disabled={saving || !name.trim() || selectedScopes.length === 0}
            className="rounded-md bg-orange-500 px-4 py-2 text-sm text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {saving ? tCommon("saving") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
