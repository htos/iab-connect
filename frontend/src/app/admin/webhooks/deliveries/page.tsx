"use client";

/**
 * REQ-058 (E8-S4): Webhook delivery history (admin).
 * Paginated, metadata-only view — never renders the payload body or the signing secret (AC-5).
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth, useApiClient } from "@/lib/auth";
import { ArrowLeft, ListChecks } from "lucide-react";
import {
  WEBHOOK_DELIVERIES_BASE,
  WebhookDeliveryDto,
  PagedResult,
} from "@/lib/api/webhooks";

const PAGE_SIZE = 20;

export default function WebhookDeliveriesPage() {
  const t = useTranslations("admin.webhookDeliveries");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const {
    isAuthenticated,
    isLoading: authLoading,
    isAdmin,
    accessToken,
  } = useAuth();
  const api = useApiClient();

  const [page, setPage] = useState(1);
  const [data, setData] = useState<PagedResult<WebhookDeliveryDto> | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  // Load the current page. All setState calls run inside the async IIFE AFTER the await, so the
  // effect body never sets state synchronously (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!(isAuthenticated && isAdmin && accessToken)) return;
    let active = true;
    (async () => {
      const res = await api.get<PagedResult<WebhookDeliveryDto>>(
        `${WEBHOOK_DELIVERIES_BASE}/?page=${page}&pageSize=${PAGE_SIZE}`
      );
      if (!active) return;
      if (res.error) setError(res.error);
      else setData(res.data);
      setIsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [isAuthenticated, isAdmin, accessToken, page, api]);

  const statusClass = (status: string) =>
    status === "Delivered"
      ? "text-green-600"
      : status === "Failed"
        ? "text-red-600"
        : "text-gray-500";

  if (authLoading) {
    return <div className="p-8 text-gray-500">{tCommon("loading")}</div>;
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

      {isLoading ? (
        <div className="text-gray-500">{tCommon("loading")}</div>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-gray-500">
          {t("noDeliveries")}
        </div>
      ) : (
        <>
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
              {data.items.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="px-4 py-2">{d.eventType}</td>
                  <td className="px-4 py-2 break-all text-gray-600">
                    {d.targetUrl}
                  </td>
                  <td className={`px-4 py-2 ${statusClass(d.status)}`}>
                    {d.status}
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
