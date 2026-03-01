"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth, useApiClient } from "@/lib/auth";
import type {
  JournalEntry,
  JournalEntryStatus,
  LedgerAccount,
  TaxCode,
} from "@/types/finance";

interface LineForm {
  ledgerAccountId: string;
  debitAmount: number;
  creditAmount: number;
  taxCodeId: string | null;
  netAmount: number;
  taxAmount: number;
  activityAreaId: string | null;
}

interface EntryForm {
  date: string;
  description: string;
  reference: string;
  lines: LineForm[];
}

const emptyLine: LineForm = {
  ledgerAccountId: "",
  debitAmount: 0,
  creditAmount: 0,
  taxCodeId: null,
  netAmount: 0,
  taxAmount: 0,
  activityAreaId: null,
};

const emptyForm: EntryForm = {
  date: new Date().toISOString().slice(0, 10),
  description: "",
  reference: "",
  lines: [{ ...emptyLine }, { ...emptyLine }],
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(amount);

export default function JournalEntriesPage() {
  const t = useTranslations("finance");
  const ta = useTranslations("finance.accounting");
  const router = useRouter();
  const { canReadFinance, canWriteFinance } = useAuth();
  const api = useApiClient();

  const apiRef = useRef(api);
  apiRef.current = api;

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);
  const [taxCodes, setTaxCodes] = useState<TaxCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<JournalEntryStatus | "">("");

  // Create / Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EntryForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Detail modal
  const [detailEntry, setDetailEntry] = useState<JournalEntry | null>(null);

  // Confirm actions
  const [confirmAction, setConfirmAction] = useState<{ type: "post" | "reverse"; id: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [modeChecked, setModeChecked] = useState(false);

  // Guard: redirect if DoubleEntry is not enabled
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiRef.current.get("/api/v1/finance/profile");
        if (!cancelled && (!res.data || (res.data as { accountingMode?: string }).accountingMode !== "DoubleEntry")) {
          router.replace("/finance/settings");
          return;
        }
      } catch {
        if (!cancelled) router.replace("/finance/settings");
        return;
      }
      if (!cancelled) setModeChecked(true);
    })();
    return () => { cancelled = true; };
  }, [router]);

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      let url = "/api/v1/finance/journal-entries";
      if (statusFilter) url += `?status=${statusFilter}`;
      const res = await apiRef.current.get(url);
      if (res.error) throw new Error(res.error);
      const data = res.data;
      const list = Array.isArray(data)
        ? (data as JournalEntry[])
        : ((data as { items?: JournalEntry[] })?.items ?? []);
      setEntries(list);
    } catch {
      setError(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [t, statusFilter]);

  const fetchLedgerAccounts = useCallback(async () => {
    const res = await apiRef.current.get("/api/v1/finance/ledger-accounts");
    if (!res.error) {
      const data = res.data;
      const list = Array.isArray(data)
        ? (data as LedgerAccount[])
        : ((data as { items?: LedgerAccount[] })?.items ?? []);
      setLedgerAccounts(list);
    }
  }, []);

  const fetchTaxCodes = useCallback(async () => {
    const res = await apiRef.current.get("/api/v1/finance/tax-codes");
    if (!res.error) {
      const body = res.data as { items: TaxCode[] };
      setTaxCodes(body.items ?? []);
    }
  }, []);

  useEffect(() => {
    if (!canReadFinance) {
      router.replace("/");
      return;
    }
    if (modeChecked) {
      fetchEntries();
      fetchLedgerAccounts();
      fetchTaxCodes();
    }
  }, [canReadFinance, router, fetchEntries, fetchLedgerAccounts, fetchTaxCodes, modeChecked]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = useCallback(async (id: string) => {
    const res = await apiRef.current.get(`/api/v1/finance/journal-entries/${id}`);
    if (res.error || !res.data) return;
    const entry = res.data as JournalEntry;
    setEditingId(entry.id);
    setForm({
      date: entry.date ? new Date(entry.date).toISOString().slice(0, 10) : "",
      description: entry.description ?? "",
      reference: entry.reference ?? "",
      lines: entry.lines.length > 0
        ? entry.lines.map((l) => ({
            ledgerAccountId: l.ledgerAccountId,
            debitAmount: l.debitAmount,
            creditAmount: l.creditAmount,
            taxCodeId: l.taxCodeId ?? null,
            netAmount: l.netAmount ?? 0,
            taxAmount: l.taxAmount ?? 0,
            activityAreaId: l.activityAreaId ?? null,
          }))
        : [{ ...emptyLine }, { ...emptyLine }],
    });
    setModalOpen(true);
  }, []);

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const updateLine = (index: number, updates: Partial<LineForm>) => {
    const newLines = [...form.lines];
    newLines[index] = { ...newLines[index], ...updates };
    setForm({ ...form, lines: newLines });
  };

  const addLine = () => setForm({ ...form, lines: [...form.lines, { ...emptyLine }] });

  const removeLine = (index: number) => {
    if (form.lines.length <= 2) return;
    setForm({ ...form, lines: form.lines.filter((_, i) => i !== index) });
  };

  const totalDebit = form.lines.reduce((sum, l) => sum + (Number(l.debitAmount) || 0), 0);
  const totalCredit = form.lines.reduce((sum, l) => sum + (Number(l.creditAmount) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.005;

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      setError(null);
      const payload = {
        date: form.date,
        description: form.description,
        reference: form.reference || null,
        lines: form.lines
          .filter((l) => l.ledgerAccountId && (l.debitAmount > 0 || l.creditAmount > 0))
          .map((l) => ({
            ledgerAccountId: l.ledgerAccountId,
            debitAmount: Number(l.debitAmount) || 0,
            creditAmount: Number(l.creditAmount) || 0,
            taxCodeId: l.taxCodeId || null,
            netAmount: Number(l.netAmount) || 0,
            taxAmount: Number(l.taxAmount) || 0,
            activityAreaId: l.activityAreaId || null,
          })),
      };
      const res = editingId
        ? await apiRef.current.put(`/api/v1/finance/journal-entries/${editingId}`, payload)
        : await apiRef.current.post("/api/v1/finance/journal-entries", payload);
      if (res.error) throw new Error(res.error);
      closeModal();
      await fetchEntries();
    } catch {
      setError(t("saveError"));
    } finally {
      setSaving(false);
    }
  }, [form, editingId, fetchEntries, t]);

  const handleAction = useCallback(async () => {
    if (!confirmAction) return;
    try {
      setActionLoading(true);
      setError(null);
      const endpoint = confirmAction.type === "post"
        ? `/api/v1/finance/journal-entries/${confirmAction.id}/post`
        : `/api/v1/finance/journal-entries/${confirmAction.id}/reverse`;
      const res = await apiRef.current.post(endpoint, {});
      if (res.error) throw new Error(res.error);
      setConfirmAction(null);
      await fetchEntries();
    } catch {
      setError(t("saveError"));
    } finally {
      setActionLoading(false);
    }
  }, [confirmAction, fetchEntries, t]);

  const fetchEntryDetail = useCallback(async (id: string) => {
    const res = await apiRef.current.get(`/api/v1/finance/journal-entries/${id}`);
    if (!res.error && res.data) {
      setDetailEntry(res.data as JournalEntry);
    }
  }, []);

  const statusBadge = (status: JournalEntryStatus) => {
    const colors: Record<JournalEntryStatus, string> = {
      Draft: "bg-gray-100 text-gray-800",
      Posted: "bg-green-100 text-green-800",
      Reversed: "bg-red-100 text-red-800",
    };
    const labels: Record<JournalEntryStatus, string> = {
      Draft: ta("statusDraft"),
      Posted: ta("statusPosted"),
      Reversed: ta("statusReversed"),
    };
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status]}`}>
        {labels[status]}
      </span>
    );
  };

  if (!canReadFinance) return null;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Back */}
        <Link href="/finance" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t("back")}
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{ta("journalEntries")}</h1>
            <p className="mt-1 text-sm text-gray-500">{ta("journalEntriesSubtitle")}</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as JournalEntryStatus | "")}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
            >
              <option value="">{t("allStatuses")}</option>
              <option value="Draft">{ta("statusDraft")}</option>
              <option value="Posted">{ta("statusPosted")}</option>
              <option value="Reversed">{ta("statusReversed")}</option>
            </select>
            {canWriteFinance && (
              <button
                onClick={openCreate}
                className="rounded-lg bg-orange-600 px-4 py-2 font-medium text-white transition-colors hover:bg-orange-700"
              >
                {ta("newJournalEntry")}
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
          </div>
        )}

        {/* Empty */}
        {!loading && entries.length === 0 && (
          <div className="rounded-xl bg-white p-6 text-center text-gray-500 shadow-sm">{ta("noJournalEntries")}</div>
        )}

        {/* Table */}
        {!loading && entries.length > 0 && (
          <div className="overflow-x-auto rounded-xl bg-white p-6 shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 text-sm text-gray-500">
                  <th className="pb-3 font-medium">{ta("entryDate")}</th>
                  <th className="pb-3 font-medium">{ta("entryDescription")}</th>
                  <th className="pb-3 font-medium">{ta("entryReference")}</th>
                  <th className="pb-3 font-medium">{ta("entryStatus")}</th>
                  <th className="pb-3 font-medium">{ta("sourceType")}</th>
                  <th className="pb-3 text-right font-medium">{t("actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry) => (
                  <tr key={entry.id} className="text-sm">
                    <td className="py-3 text-gray-900">{new Date(entry.date).toLocaleDateString("de-CH")}</td>
                    <td className="py-3 text-gray-900 max-w-xs truncate">{entry.description}</td>
                    <td className="py-3 text-gray-600">{entry.reference ?? "–"}</td>
                    <td className="py-3">{statusBadge(entry.status)}</td>
                    <td className="py-3 text-gray-600">{entry.sourceType ?? "–"}</td>
                    <td className="space-x-2 py-3 text-right">
                      <button
                        onClick={() => fetchEntryDetail(entry.id)}
                        className="text-sm font-medium text-orange-600 hover:text-orange-700"
                      >
                        {t("view")}
                      </button>
                      {canWriteFinance && entry.status === "Draft" && (
                        <button
                          onClick={() => openEdit(entry.id)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-700"
                        >
                          {t("edit")}
                        </button>
                      )}
                      {canWriteFinance && entry.status === "Draft" && (
                        <button
                          onClick={() => setConfirmAction({ type: "post", id: entry.id })}
                          className="text-sm font-medium text-green-600 hover:text-green-700"
                        >
                          {ta("post")}
                        </button>
                      )}
                      {canWriteFinance && entry.status === "Posted" && (
                        <button
                          onClick={() => setConfirmAction({ type: "reverse", id: entry.id })}
                          className="text-sm font-medium text-red-600 hover:text-red-700"
                        >
                          {ta("reverse")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Detail Modal */}
        {detailEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-3xl space-y-4 rounded-xl bg-white p-6 shadow-lg max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">{ta("journalEntries")} – {detailEntry.description}</h2>
                {statusBadge(detailEntry.status)}
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><span className="text-gray-500">{ta("entryDate")}:</span> {new Date(detailEntry.date).toLocaleDateString("de-CH")}</div>
                <div><span className="text-gray-500">{ta("entryReference")}:</span> {detailEntry.reference ?? "–"}</div>
                <div><span className="text-gray-500">{ta("sourceType")}:</span> {detailEntry.sourceType ?? "–"}</div>
              </div>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="pb-2 font-medium">{ta("ledgerAccount")}</th>
                    <th className="pb-2 text-right font-medium">{ta("debitAmount")}</th>
                    <th className="pb-2 text-right font-medium">{ta("creditAmount")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {detailEntry.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="py-2">{line.ledgerAccountNumber} – {line.ledgerAccountName}</td>
                      <td className="py-2 text-right font-mono">{line.debitAmount > 0 ? formatCurrency(line.debitAmount) : ""}</td>
                      <td className="py-2 text-right font-mono">{line.creditAmount > 0 ? formatCurrency(line.creditAmount) : ""}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 font-semibold">
                    <td className="py-2">{ta("totalDebit")} / {ta("totalCredit")}</td>
                    <td className="py-2 text-right font-mono">
                      {formatCurrency(detailEntry.lines.reduce((s, l) => s + l.debitAmount, 0))}
                    </td>
                    <td className="py-2 text-right font-mono">
                      {formatCurrency(detailEntry.lines.reduce((s, l) => s + l.creditAmount, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setDetailEntry(null)}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                >
                  {t("cancel")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-4xl space-y-4 rounded-xl bg-white p-6 shadow-lg max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-bold text-gray-900">{editingId ? ta("editJournalEntry") : ta("newJournalEntry")}</h2>
              <div className="grid grid-cols-3 gap-4">
                {/* Date */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{ta("entryDate")} *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
                {/* Description */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{ta("entryDescription")} *</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
                {/* Reference */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{ta("entryReference")}</label>
                  <input
                    type="text"
                    value={form.reference}
                    onChange={(e) => setForm({ ...form, reference: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Lines */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">{ta("lines")}</h3>
                  <button onClick={addLine} className="text-sm font-medium text-orange-600 hover:text-orange-700">
                    + {ta("addLine")}
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-500">
                        <th className="pb-2 font-medium">{ta("ledgerAccount")}</th>
                        <th className="pb-2 text-right font-medium">{ta("debitAmount")}</th>
                        <th className="pb-2 text-right font-medium">{ta("creditAmount")}</th>
                        <th className="pb-2 font-medium">{ta("taxCode")}</th>
                        <th className="pb-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {form.lines.map((line, idx) => (
                        <tr key={idx}>
                          <td className="py-2 pr-2">
                            <select
                              value={line.ledgerAccountId}
                              onChange={(e) => updateLine(idx, { ledgerAccountId: e.target.value })}
                              className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                            >
                              <option value="">{ta("selectLedgerAccount")}</option>
                              {ledgerAccounts.filter((a) => a.isActive).map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.number} – {a.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.debitAmount || ""}
                              onChange={(e) => updateLine(idx, { debitAmount: Number(e.target.value) || 0 })}
                              className="w-28 rounded border border-gray-300 px-2 py-1 text-right text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.creditAmount || ""}
                              onChange={(e) => updateLine(idx, { creditAmount: Number(e.target.value) || 0 })}
                              className="w-28 rounded border border-gray-300 px-2 py-1 text-right text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <select
                              value={line.taxCodeId ?? ""}
                              onChange={(e) => updateLine(idx, { taxCodeId: e.target.value || null })}
                              className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                            >
                              <option value="">{ta("selectTaxCode")}</option>
                              {taxCodes.filter((tc) => tc.isActive).map((tc) => (
                                <option key={tc.id} value={tc.id}>
                                  {tc.code} ({tc.rate}%)
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2">
                            {form.lines.length > 2 && (
                              <button onClick={() => removeLine(idx)} className="text-red-500 hover:text-red-700">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 font-semibold">
                        <td className="py-2">
                          {isBalanced ? (
                            <span className="text-green-600 text-xs">{ta("balanced")}</span>
                          ) : (
                            <span className="text-red-600 text-xs">{ta("notBalanced")}</span>
                          )}
                        </td>
                        <td className="py-2 text-right font-mono">{formatCurrency(totalDebit)}</td>
                        <td className="py-2 text-right font-mono">{formatCurrency(totalCredit)}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={closeModal} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200">
                  {t("cancel")}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.description || !form.date || !isBalanced}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
                >
                  {saving ? "..." : t("save")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Post/Reverse */}
        {confirmAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-lg">
              <h2 className="text-lg font-bold text-gray-900">
                {confirmAction.type === "post" ? ta("post") : ta("reverse")}
              </h2>
              <p className="text-sm text-gray-600">
                {confirmAction.type === "post" ? ta("confirmPost") : ta("confirmReverse")}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmAction(null)}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={handleAction}
                  disabled={actionLoading}
                  className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
                    confirmAction.type === "post"
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {actionLoading ? "..." : confirmAction.type === "post" ? ta("post") : ta("reverse")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
