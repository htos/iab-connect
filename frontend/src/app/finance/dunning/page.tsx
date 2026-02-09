"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth, useApiClient } from "@/lib/auth";

interface DunningNotice {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  recipientName: string;
  level: number;
  date: string;
  dueDate: string;
  status: "Draft" | "Sent";
}

interface OverdueInvoice {
  id: string;
  invoiceNumber: string;
  recipientName: string;
  total: number;
  dueDate: string;
}

const formatCHF = (amount: number) =>
  new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(
    amount
  );

export default function DunningPage() {
  const t = useTranslations("finance");
  const router = useRouter();
  const { canReadFinance, canWriteFinance } = useAuth();
  const api = useApiClient();

  const apiRef = useRef(api);
  apiRef.current = api;
  const tRef = useRef(t);
  tRef.current = t;

  const [notices, setNotices] = useState<DunningNotice[]>([]);
  const [overdueInvoices, setOverdueInvoices] = useState<OverdueInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    invoiceId: "",
    level: 1,
    dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
  });

  const fetchNotices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiRef.current.get("/api/v1/finance/dunning");
      if (res.error) throw new Error(res.error);
      setNotices(res.data as DunningNotice[]);
    } catch {
      setError(tRef.current("loadError"));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOverdueInvoices = useCallback(async () => {
    try {
      const [overdueRes, sentRes] = await Promise.all([
        apiRef.current.get("/api/v1/finance/invoices?status=Overdue"),
        apiRef.current.get("/api/v1/finance/invoices?status=Sent"),
      ]);
      if (overdueRes.error) throw new Error(overdueRes.error);
      if (sentRes.error) throw new Error(sentRes.error);
      setOverdueInvoices([
        ...(overdueRes.data as OverdueInvoice[]),
        ...(sentRes.data as OverdueInvoice[]),
      ]);
    } catch {
      // non-critical, modal can still open
    }
  }, []);

  useEffect(() => {
    if (!canReadFinance) {
      router.replace("/");
      return;
    }
    fetchNotices();
  }, [canReadFinance, router, fetchNotices]);

  const openCreate = async () => {
    await fetchOverdueInvoices();
    setForm({
      invoiceId: "",
      level: 1,
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  // Auto-suggest level based on existing dunnings for the selected invoice
  const handleInvoiceChange = (invoiceId: string) => {
    const existing = notices.filter((n) => n.invoiceId === invoiceId);
    const maxLevel = existing.reduce((max, n) => Math.max(max, n.level), 0);
    const suggestedLevel = Math.min(maxLevel + 1, 3);
    setForm({ ...form, invoiceId, level: suggestedLevel });
  };

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      setError(null);
      await apiRef.current.post("/api/v1/finance/dunning", form);
      closeModal();
      await fetchNotices();
    } catch {
      setError(tRef.current("saveError"));
    } finally {
      setSaving(false);
    }
  }, [form, fetchNotices]);

  const handleSend = useCallback(
    async (id: string) => {
      try {
        setSendingId(id);
        setError(null);
        await apiRef.current.post(`/api/v1/finance/dunning/${id}/send`, {});
        await fetchNotices();
      } catch {
        setError(tRef.current("saveError"));
      } finally {
        setSendingId(null);
      }
    },
    [fetchNotices]
  );

  const levelBadge = (level: number) => {
    const colors: Record<number, string> = {
      1: "bg-yellow-100 text-yellow-800",
      2: "bg-orange-100 text-orange-800",
      3: "bg-red-100 text-red-800",
    };
    const labels: Record<number, () => string> = {
      1: () => tRef.current("firstReminder"),
      2: () => tRef.current("secondReminder"),
      3: () => tRef.current("thirdReminder"),
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

  if (!canReadFinance) return null;

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
        {error && (
          <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
          </div>
        )}

        {/* Empty State */}
        {!loading && notices.length === 0 && (
          <div className="rounded-xl bg-white p-6 text-center text-gray-500 shadow-sm">
            {t("noDunningNotices")}
          </div>
        )}

        {/* Dunning Notices Table */}
        {!loading && notices.length > 0 && (
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
                {notices.map((notice) => (
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

        {/* Create Dunning Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-lg">
              <h2 className="text-lg font-bold text-gray-900">
                {t("createDunning")}
              </h2>

              <div className="space-y-3">
                {/* Invoice Select */}
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

                {/* Level */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("dunningLevel")} *
                  </label>
                  <select
                    value={form.level}
                    onChange={(e) =>
                      setForm({ ...form, level: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  >
                    <option value={1}>{t("firstReminder")}</option>
                    <option value={2}>{t("secondReminder")}</option>
                    <option value={3}>{t("thirdReminder")}</option>
                  </select>
                </div>

                {/* Due Date */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("dueDate")} *
                  </label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) =>
                      setForm({ ...form, dueDate: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={closeModal}
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
