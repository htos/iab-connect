"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, AlertTriangle } from "lucide-react";
import type { WebhookSubscriptionCreatedDto } from "../types/admin-integrations.types";

/**
 * Show-once signing-secret panel for a freshly-created webhook subscription (E27-S5,
 * behaviour-LOCKED, data-loss path). Identical mechanism to the api-client panel,
 * shown ONLY on create (the edit/PUT path never produces a secret; there is NO
 * regenerate action — do not invent one). Markup + behaviour byte-identical to the
 * god-page:
 *   - the cleartext signing secret (sourced ONLY from the create response, held in
 *     the parent's `createdSecret` state) renders ONCE in a `<code>`;
 *   - Copy → `navigator.clipboard.writeText(secret)` then flips `copy` → `copied`
 *     (NO timer);
 *   - Dismiss → the parent's `onDismiss` clears `createdSecret`, removing the ONLY
 *     source of the cleartext (the list refetch can NEVER reintroduce it).
 */
export function WebhookSecretPanel({
  secret,
  onDismiss,
}: {
  secret: WebhookSubscriptionCreatedDto;
  onDismiss: () => void;
}) {
  const t = useTranslations("admin.webhooks");
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
