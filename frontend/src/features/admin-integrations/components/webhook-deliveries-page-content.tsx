"use client";

/**
 * REQ-058 (E8-S4): Webhook delivery history (admin). Feature-slice composition root
 * (E27-S5) rendered by the thin `app/admin/webhooks/deliveries/page.tsx` route entry;
 * the single `"use client"` boundary for the surface.
 *
 * Behaviour preserved verbatim (pinned by the E27-S1 net):
 *   - admin auth guard: non-admins → `router.push("/")`; the fetch is gated on
 *     `isAuthenticated && isAdmin && accessToken`;
 *   - paginated, metadata-only, READ-ONLY: GET `/?page=&pageSize=20`, prev/next gated
 *     on `hasPreviousPage`/`hasNextPage`; NO filters, NO retry action; the payload body
 *     is NEVER rendered (AC-2);
 *   - the error banner + the empty state + the `pageOf` summary.
 *
 * A79: the god-page's manual `page` effect + `useState` becomes TanStack
 * (`useWebhookDeliveries(page, enabled)` keyed on the page — changing `page` refetches).
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, ListChecks } from "lucide-react";
import { useWebhookDeliveries } from "../hooks/use-webhook-deliveries";
import { DeliveriesTable } from "./deliveries-table";

export function WebhookDeliveriesPageContent() {
  const t = useTranslations("admin.webhookDeliveries");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const {
    isAuthenticated,
    isLoading: authLoading,
    isAdmin,
    accessToken,
  } = useAuth();

  const enabled = !!(isAuthenticated && isAdmin && accessToken);

  const [page, setPage] = useState(1);
  const deliveriesQuery = useWebhookDeliveries(page, enabled);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  const data = deliveriesQuery.data ?? null;
  const error =
    deliveriesQuery.error instanceof Error && deliveriesQuery.error.message
      ? deliveriesQuery.error.message
      : null;

  // Table-region loading mirrors the god-page's `isLoading` (true until the gated load
  // resolves; when gated off it stayed true). The early `authLoading` screen is below.
  const tableLoading = enabled ? deliveriesQuery.isLoading : true;

  if (authLoading) {
    return <div className="p-8 text-gray-500">{tCommon("loading")}</div>;
  }

  // Explicit non-admin terminal (A90/A97), matching the sibling api-clients /
  // webhooks pages, so a stalled redirect can't render the shell for a non-admin.
  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <Link
        href="/admin/webhooks"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> {tCommon("back")}
      </Link>

      <h1 className="mb-2 flex items-center gap-2 text-2xl font-semibold">
        <ListChecks className="h-6 w-6 text-orange-500" /> {t("title")}
      </h1>
      <p className="mb-6 text-gray-500">{t("description")}</p>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {tableLoading ? (
        <div className="text-gray-500">{tCommon("loading")}</div>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-gray-500">
          {t("noDeliveries")}
        </div>
      ) : (
        <>
          <DeliveriesTable items={data.items} />

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {t("pageOf", { page: data.page, total: data.totalPages || 1 })}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!data.hasPreviousPage}
                className="rounded-md border px-3 py-1 disabled:opacity-50"
              >
                {tCommon("previous")}
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!data.hasNextPage}
                className="rounded-md border px-3 py-1 disabled:opacity-50"
              >
                {tCommon("next")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
