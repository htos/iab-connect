"use client";

/**
 * Dunning content (E26-S3 migration of `app/finance/dunning/page.tsx`).
 * Composition root (only `"use client"`) — self-embeds its own `QueryClientProvider`.
 *
 * Lean read guard (A56): reads `canReadFinance` ONLY; useEffect → `router.replace("/")`;
 * render-time `if (!canReadFinance) return null`. Create modal first GETs BOTH
 * invoices?status=Overdue and invoices?status=Sent to populate the select (imperative, on
 * openCreate). Send (Draft rows) = POST /dunning/{id}/send (orange affordance, A86). The
 * create/send handlers do NOT inspect res.error (god-page parity) — the mutations close
 * the modal from onSuccess (A92).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useApiClient, useAuth } from "@/lib/auth";
import { formatCHF } from "@/lib/utils";
import { receivablesUrls } from "../../api/receivables-api";
import {
  useCreateDunning,
  useDunning,
  useSendDunning,
} from "../../hooks/use-dunning";
import type {
  DunningNotice,
  DunningOverdueInvoice,
} from "../../types/receivables.types";

const defaultForm = () => ({
  invoiceId: "",
  level: 1,
  dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
});

function DunningBody() {
  const t = useTranslations("finance");
  const router = useRouter();
  const { canReadFinance, canWriteFinance } = useAuth();
  const api = useApiClient();

  const dunningQuery = useDunning(canReadFinance);
  const notices = dunningQuery.data ?? [];
  const loading = canReadFinance && dunningQuery.isLoading;

  const createMutation = useCreateDunning();
  const sendMutation = useSendDunning();

  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [overdueInvoices, setOverdueInvoices] = useState<
    DunningOverdueInvoice[]
  >([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);

  const banner = error ?? (dunningQuery.isError ? t("loadError") : null);

  useEffect(() => {
    if (!canReadFinance) {
      router.replace("/");
    }
  }, [canReadFinance, router]);

  const fetchOverdueInvoices = async () => {
    try {
      const [overdueRes, sentRes] = await Promise.all([
        api.get(receivablesUrls.invoices("Overdue")),
        api.get(receivablesUrls.invoices("Sent")),
      ]);
      if (overdueRes.error) throw new Error(overdueRes.error);
      if (sentRes.error) throw new Error(sentRes.error);
      const overdueBody = overdueRes.data as { items: DunningOverdueInvoice[] };
      const sentBody = sentRes.data as { items: DunningOverdueInvoice[] };
      setOverdueInvoices([
        ...(overdueBody.items ?? []),
        ...(sentBody.items ?? []),
      ]);
    } catch {
      // non-critical, modal can still open
    }
  };

  const openCreate = async () => {
    await fetchOverdueInvoices();
    setForm(defaultForm());
    setModalOpen(true);
  };

  const handleInvoiceChange = (invoiceId: string) => {
    const existing = notices.filter((n) => n.invoiceId === invoiceId);
    const maxLevel = existing.reduce((max, n) => Math.max(max, n.level), 0);
    const suggestedLevel = Math.min(maxLevel + 1, 3);
    setForm((f) => ({ ...f, invoiceId, level: suggestedLevel }));
  };

  const handleSave = () => {
    setError(null);
    createMutation.mutate(form, {
      onSuccess: () => setModalOpen(false),
      onError: () => setError(t("saveError")),
    });
  };

  const handleSend = (id: string) => {
    setSendingId(id);
    setError(null);
    sendMutation.mutate(id, {
      onError: () => setError(t("saveError")),
      onSettled: () => setSendingId(null),
    });
  };

  const levelBadge = (level: number) => {
    const colors: Record<number, string> = {
      1: "bg-yellow-100 text-yellow-800",
      2: "bg-orange-100 text-orange-800",
      3: "bg-red-100 text-red-800",
    };
    const labels: Record<number, () => string> = {
      1: () => t("firstReminder"),
      2: () => t("secondReminder"),
      3: () => t("thirdReminder"),
    };
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[level] ?? colors[3]}`}
      >
        {(labels[level] ?? labels[3])()}
      </span>
    );
  };

  const statusBadge = (status: DunningNotice["status"]) => {
    const colors: Record<DunningNotice["status"], string> = {
      Draft: "bg-gray-100 text-gray-800",
      Sent: "bg-blue-100 text-blue-800",
    };
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status]}`}
      >
        {status}
      </span>
    );
  };

  const filteredNotices = notices.filter((n) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      n.invoiceNumber.toLowerCase().includes(term) ||
      n.recipientName.toLowerCase().includes(term) ||
      String(n.level).includes(term) ||
      n.status.toLowerCase().includes(term) ||
      new Date(n.date).toLocaleDateString("de-CH").includes(term) ||
      new Date(n.dueDate).toLocaleDateString("de-CH").includes(term)
    );
  });

  if (!canReadFinance) return null;

  const saving = createMutation.isPending;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{t("dunning")}</h1>
          {canWriteFinance && (
            <button
              onClick={openCreate}
              className="rounded-lg bg-orange-600 px-4 py-2 font-medium text-white transition-colors hover:bg-orange-700"
            >
              {t("createDunning")}
            </button>
          )}
        </div>

        {/* Error Banner */}
        {banner && (
          <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            <span>{banner}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        )}

        {/* Search */}
        <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
          <div className="relative">
            <svg
              className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder={t("searchDunning")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-10 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
          </div>
        )}

        {/* Empty */}
        {!loading && filteredNotices.length === 0 && (
          <div className="rounded-xl bg-white p-6 text-center text-gray-500 shadow-sm">
            {t("noDunningNotices")}
          </div>
        )}

        {/* Table */}
        {!loading && filteredNotices.length > 0 && (
          <div className="overflow-x-auto rounded-xl bg-white p-6 shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 text-sm text-gray-500">
                  <th className="pb-3 font-medium">{t("invoiceNumber")}</th>
                  <th className="pb-3 font-medium">{t("recipient")}</th>
                  <th className="pb-3 font-medium">{t("dunningLevel")}</th>
                  <th className="pb-3 font-medium">{t("date")}</th>
                  <th className="pb-3 font-medium">{t("dueDate")}</th>
                  <th className="pb-3 font-medium">{t("status")}</th>
                  {canWriteFinance && (
                    <th className="pb-3 text-right font-medium">
                      {t("actions")}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredNotices.map((notice) => (
                  <tr key={notice.id} className="text-sm">
                    <td className="py-3 font-medium text-gray-900">
                      {notice.invoiceNumber}
                    </td>
                    <td className="py-3 text-gray-700">
                      {notice.recipientName}
                    </td>
                    <td className="py-3">{levelBadge(notice.level)}</td>
                    <td className="py-3 text-gray-500">
                      {new Date(notice.date).toLocaleDateString("de-CH")}
                    </td>
                    <td className="py-3 text-gray-500">
                      {new Date(notice.dueDate).toLocaleDateString("de-CH")}
                    </td>
                    <td className="py-3">{statusBadge(notice.status)}</td>
                    {canWriteFinance && (
                      <td className="py-3 text-right">
                        {notice.status === "Draft" && (
                          <button
                            onClick={() => handleSend(notice.id)}
                            disabled={sendingId === notice.id}
                            className="text-sm font-medium text-orange-600 hover:text-orange-700 disabled:opacity-50"
                          >
                            {sendingId === notice.id ? "..." : t("send")}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-lg">
              <h2 className="text-lg font-bold text-gray-900">
                {t("createDunning")}
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("selectOverdueInvoice")} *
                  </label>
                  <select
                    value={form.invoiceId}
                    onChange={(e) => handleInvoiceChange(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  >
                    <option value="">{t("selectOverdueInvoice")}</option>
                    {overdueInvoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNumber} – {inv.recipientName} (
                        {formatCHF(inv.total)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("dunningLevel")} *
                  </label>
                  <select
                    value={form.level}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, level: Number(e.target.value) }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  >
                    <option value={1}>{t("firstReminder")}</option>
                    <option value={2}>{t("secondReminder")}</option>
                    <option value={3}>{t("thirdReminder")}</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("dueDate")} *
                  </label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, dueDate: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.invoiceId}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
                >
                  {saving ? "..." : t("save")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export function DunningPageContent() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <DunningBody />
    </QueryClientProvider>
  );
}
