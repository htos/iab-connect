"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, AlertTriangle } from "lucide-react";
import type { ApiClientCreatedDto } from "../types/admin-integrations.types";

/**
 * Show-once secret panel for a freshly-created api client (E27-S5, behaviour-LOCKED,
 * highest data-loss risk in the epic). Markup + behaviour are byte-identical to the
 * god-page:
 *   - the cleartext secret (sourced ONLY from the create response, held in the
 *     parent's `createdSecret` state) is rendered ONCE in a `<code>`;
 *   - Copy → `navigator.clipboard.writeText(secret)` then flips `copy` → `copied`
 *     (NO timer — `copied` stays until the panel is dismissed/unmounted);
 *   - Dismiss → the parent's `onDismiss` sets `createdSecret` to null, removing the
 *     ONLY source of the cleartext (the list refetch can NEVER reintroduce it — the
 *     list DTO carries no secret). The `copied` flag is local panel state, reset
 *     naturally when the panel unmounts on the next create.
 */
export function ApiClientSecretPanel({
  secret,
  onDismiss,
}: {
  secret: ApiClientCreatedDto;
  onDismiss: () => void;
}) {
  const t = useTranslations("admin.apiClients");
  const [copied, setCopied] = useState(false);

  const copySecret = async () => {
    await navigator.clipboard.writeText(secret.secret);
    setCopied(true);
  };

  return (
    <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4">
      <div className="mb-2 flex items-center gap-2 font-medium text-amber-800">
        <AlertTriangle className="h-5 w-5" /> {t("secretOnceWarning")}
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded border border-amber-200 bg-white px-3 py-2 text-sm break-all">
          {secret.secret}
        </code>
        <button
          onClick={copySecret}
          className="inline-flex items-center gap-1 rounded border border-amber-300 px-3 py-2 text-sm hover:bg-amber-100"
        >
          <Copy className="h-4 w-4" /> {copied ? t("copied") : t("copy")}
        </button>
      </div>
      <button
        onClick={onDismiss}
        className="mt-3 text-sm text-amber-700 underline"
      >
        {t("dismissSecret")}
      </button>
    </div>
  );
}
