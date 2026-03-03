"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useAuth, useApiClient } from "@/lib/auth";
import type { ExpenseClaim, ExpenseClaimStatus } from "@/types/finance";

const formatAmount = (amount: number, currency: string) =>
  new Intl.NumberFormat("de-CH", { style: "currency", currency }).format(amount);

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const statusColors: Record<ExpenseClaimStatus, string> = {
  Draft: "bg-gray-100 text-gray-800",
  Submitted: "bg-orange-100 text-orange-800",
  UnderReview: "bg-yellow-100 text-yellow-800",
  Approved: "bg-green-100 text-green-800",
  Rejected: "bg-red-100 text-red-800",
  Reimbursed: "bg-emerald-100 text-emerald-800",
};

interface ClaimFormData {
  title: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  receiptId: string;
}

const emptyForm: ClaimFormData = {
  title: "",
  description: "",
  amount: 0,
  currency: "CHF",
  date: new Date().toISOString().split("T")[0],
  receiptId: "",
};

export default function ExpenseClaimsPage() {
  const t = useTranslations("expenseClaims");
  const tFinance = useTranslations("finance");
  const { canReadFinance, canWriteFinance, isKassier, isVorstand, isAdmin, user } =
    useAuth();
  const api = useApiClient();

  const tRef = useRef(t);
  tRef.current = t;
  const apiRef = useRef(api);
  apiRef.current = api;

  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<ExpenseClaimStatus | "all">("all");
  const [myClaimsOnly, setMyClaimsOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Create/Edit modal
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingClaim, setEditingClaim] = useState<ExpenseClaim | null>(null);
  const [formData, setFormData] = useState<ClaimFormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  // Detail modal
  const [selectedClaim, setSelectedClaim] = useState<ExpenseClaim | null>(null);

  // Action modals
  const [actionModal, setActionModal] = useState<{
    type: "submit" | "review" | "approve" | "reject" | "reimburse" | "delete";
    claim: ExpenseClaim;
  } | null>(null);
  const [actionComment, setActionComment] = useState("");
  const [actionReason, setActionReason] = useState("");
  const [reimburseMethod, setReimburseMethod] = useState<"Transfer" | "Cash" | "Online">("Transfer");
  const [reimburseReference, setReimburseReference] = useState("");

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (myClaimsOnly) params.set("myClaimsOnly", "true");
      const qs = params.toString();
      const res = await apiRef.current.get(
        `/api/v1/finance/expense-claims${qs ? `?${qs}` : ""}`
      );
      if (res.error) throw new Error(res.error);
      const body = res.data as { items: ExpenseClaim[] };
      setClaims(body.items ?? []);
    } catch {
      setError(tRef.current("error"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, myClaimsOnly]);

  useEffect(() => {
    if (canReadFinance) fetchClaims();
  }, [canReadFinance, fetchClaims]);

  // Auto-dismiss success
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  const statusLabel = (s: ExpenseClaimStatus) => {
    const map: Record<ExpenseClaimStatus, string> = {
      Draft: t("statusDraft"),
      Submitted: t("statusSubmitted"),
      UnderReview: t("statusUnderReview"),
      Approved: t("statusApproved"),
      Rejected: t("statusRejected"),
      Reimbursed: t("statusReimbursed"),
    };
    return map[s];
  };

  /* ---------- CRUD / workflow helpers ---------- */

  const openCreateModal = () => {
    setEditingClaim(null);
    setFormData(emptyForm);
    setShowFormModal(true);
  };

  const openEditModal = (c: ExpenseClaim) => {
    setEditingClaim(c);
    setFormData({
      title: c.title,
      description: c.description,
      amount: c.amount,
      currency: c.currency,
      date: c.date.split("T")[0],
      receiptId: c.receiptId ?? "",
    });
    setShowFormModal(true);
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        receiptId: formData.receiptId || null,
      };
      if (editingClaim) {
        const res = await apiRef.current.put(
          `/api/v1/finance/expense-claims/${editingClaim.id}`,
          payload
        );
        if (res.error) throw new Error(res.error);
      } else {
        const res = await apiRef.current.post(
          "/api/v1/finance/expense-claims",
          payload
        );
        if (res.error) throw new Error(res.error);
      }
      setShowFormModal(false);
      setSuccessMsg(t("success"));
      await fetchClaims();
    } catch {
      setError(t("error"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async () => {
    if (!actionModal) return;
    setSubmitting(true);
    try {
      const { type, claim } = actionModal;
      let res;
      switch (type) {
        case "submit":
          res = await apiRef.current.post(
            `/api/v1/finance/expense-claims/${claim.id}/submit`,
            {}
          );
          break;
        case "review":
          res = await apiRef.current.post(
            `/api/v1/finance/expense-claims/${claim.id}/review`,
            { comment: actionComment }
          );
          break;
        case "approve":
          res = await apiRef.current.post(
            `/api/v1/finance/expense-claims/${claim.id}/approve`,
            { comment: actionComment }
          );
          break;
        case "reject":
          res = await apiRef.current.post(
            `/api/v1/finance/expense-claims/${claim.id}/reject`,
            { reason: actionReason }
          );
          break;
        case "reimburse":
          res = await apiRef.current.post(
            `/api/v1/finance/expense-claims/${claim.id}/reimburse`,
            { method: reimburseMethod, reference: reimburseReference || null, notes: actionComment || null }
          );
          break;
        case "delete":
          res = await apiRef.current.delete(
            `/api/v1/finance/expense-claims/${claim.id}`
          );
          break;
      }
      if (res?.error) throw new Error(res.error);
      setActionModal(null);
      setActionComment("");
      setActionReason("");
      setReimburseMethod("Transfer");
      setReimburseReference("");
      setSuccessMsg(t("success"));
      await fetchClaims();
    } catch {
      setError(t("error"));
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------- Permissions per claim ---------- */

  const canEdit = (c: ExpenseClaim) =>
    c.status === "Draft" && (c.claimantId === user?.email || isAdmin);
  const canSubmit = (c: ExpenseClaim) =>
    c.status === "Draft" && (c.claimantId === user?.email || isAdmin);
  const canReview = (c: ExpenseClaim) =>
    c.status === "Submitted" && (isKassier || isAdmin);
  const canApprove = (c: ExpenseClaim) =>
    c.status === "UnderReview" && (isVorstand || isAdmin);
  const canReject = (c: ExpenseClaim) =>
    (c.status === "Submitted" || c.status === "UnderReview") &&
    (isKassier || isVorstand || isAdmin);
  const canReimburse = (c: ExpenseClaim) =>
    c.status === "Approved" && (isKassier || isAdmin);
  const canDelete = (c: ExpenseClaim) =>
    c.status === "Draft" && (c.claimantId === user?.email || isAdmin);

  const filteredClaims = claims.filter((c) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.title.toLowerCase().includes(term) ||
      (c.description && c.description.toLowerCase().includes(term)) ||
      (c.claimantName && c.claimantName.toLowerCase().includes(term)) ||
      formatAmount(c.amount, c.currency).toLowerCase().includes(term)
    );
  });

  if (!canReadFinance) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        Not authorized
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
            <p className="mt-1 text-sm text-gray-500">{t("subtitle")}</p>
          </div>
          {canWriteFinance && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700"
            >
              <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t("create")}
            </button>
          )}
        </div>

        {/* Success Banner */}
        {successMsg && (
          <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-700">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="text-green-500 hover:text-green-700">✕</button>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">✕</button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder={tFinance("searchExpenseClaims")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ExpenseClaimStatus | "all")}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
          >
            <option value="all">{t("status")} — {t("allClaims")}</option>
            <option value="Draft">{t("statusDraft")}</option>
            <option value="Submitted">{t("statusSubmitted")}</option>
            <option value="UnderReview">{t("statusUnderReview")}</option>
            <option value="Approved">{t("statusApproved")}</option>
            <option value="Rejected">{t("statusRejected")}</option>
            <option value="Reimbursed">{t("statusReimbursed")}</option>
          </select>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={myClaimsOnly}
              onChange={(e) => setMyClaimsOnly(e.target.checked)}
              className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            />
              {t("myClaimsOnly")}
            </label>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-orange-600" />
          </div>
        )}

        {/* Claims Table */}
        {!loading && filteredClaims.length === 0 && (
          <div className="rounded-xl bg-white p-12 text-center shadow-sm">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
            </svg>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">{t("noClaimsTitle")}</h3>
            <p className="mt-1 text-sm text-gray-500">{t("noClaimsMessage")}</p>
          </div>
        )}

        {!loading && filteredClaims.length > 0 && (
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      {t("claimTitle")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      {t("claimant")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      {t("date")}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      {t("amount")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      {t("status")}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      {t("actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredClaims.map((c) => (
                    <tr
                      key={c.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => setSelectedClaim(c)}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {c.title}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {c.claimantName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(c.date)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900">
                        {formatAmount(c.amount, c.currency)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[c.status]}`}
                        >
                          {statusLabel(c.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        <div
                          className="flex justify-end gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {canEdit(c) && (
                            <button
                              onClick={() => openEditModal(c)}
                              className="text-orange-600 hover:text-orange-800"
                            >
                              {t("edit")}
                            </button>
                          )}
                          {canSubmit(c) && (
                            <button
                              onClick={() =>
                                setActionModal({ type: "submit", claim: c })
                              }
                              className="text-orange-600 hover:text-orange-800"
                            >
                              {t("submit")}
                            </button>
                          )}
                          {canReview(c) && (
                            <button
                              onClick={() =>
                                setActionModal({ type: "review", claim: c })
                              }
                              className="text-orange-600 hover:text-orange-800"
                            >
                              {t("review")}
                            </button>
                          )}
                          {canApprove(c) && (
                            <button
                              onClick={() =>
                                setActionModal({ type: "approve", claim: c })
                              }
                              className="text-green-600 hover:text-green-800"
                            >
                              {t("approve")}
                            </button>
                          )}
                          {canReject(c) && (
                            <button
                              onClick={() =>
                                setActionModal({ type: "reject", claim: c })
                              }
                              className="text-red-600 hover:text-red-800"
                            >
                              {t("reject")}
                            </button>
                          )}
                          {canReimburse(c) && (
                            <button
                              onClick={() =>
                                setActionModal({ type: "reimburse", claim: c })
                              }
                              className="text-emerald-600 hover:text-emerald-800"
                            >
                              {t("reimburse")}
                            </button>
                          )}
                          {canDelete(c) && (
                            <button
                              onClick={() =>
                                setActionModal({ type: "delete", claim: c })
                              }
                              className="text-red-600 hover:text-red-800"
                            >
                              {t("delete")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== CREATE / EDIT MODAL ==================== */}
        {showFormModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-lg">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingClaim ? t("editTitle") : t("createTitle")}
              </h2>

              {/* Title */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("claimTitle")}
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
                  placeholder={t("titlePlaceholder")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("description")}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                  placeholder={t("descriptionPlaceholder")}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
                />
              </div>

              {/* Amount + Currency */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("amount")}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount || ""}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        amount: parseFloat(e.target.value) || 0,
                      }))
                    }
                    placeholder={t("amountPlaceholder")}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("currency")}
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData((f) => ({ ...f, currency: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
                  >
                    <option value="CHF">CHF</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("date")}
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData((f) => ({ ...f, date: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={() => setShowFormModal(false)}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                >
                  {t("cancel") || "Cancel"}
                </button>
                <button
                  onClick={handleSave}
                  disabled={submitting || !formData.title || !formData.amount}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? (
                    <span className="inline-flex items-center">
                      <span className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                      …
                    </span>
                  ) : editingClaim ? (
                    t("edit")
                  ) : (
                    t("create")
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== DETAIL MODAL ==================== */}
        {selectedClaim && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-2xl space-y-5 rounded-xl bg-white p-6 shadow-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  {t("details")}
                </h2>
                <button
                  onClick={() => setSelectedClaim(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              {/* Claim info */}
              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-900">
                    {selectedClaim.title}
                  </h3>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[selectedClaim.status]}`}
                  >
                    {statusLabel(selectedClaim.status)}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {selectedClaim.description}
                </p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-500">{t("amount")}:</span>{" "}
                    <span className="text-gray-900">
                      {formatAmount(selectedClaim.amount, selectedClaim.currency)}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">{t("date")}:</span>{" "}
                    <span className="text-gray-900">
                      {formatDate(selectedClaim.date)}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">{t("claimant")}:</span>{" "}
                    <span className="text-gray-900">{selectedClaim.claimantName}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">{t("currency")}:</span>{" "}
                    <span className="text-gray-900">{selectedClaim.currency}</span>
                  </div>
                </div>
              </div>

              {/* Audit Trail */}
              <div>
                <h4 className="mb-3 text-sm font-semibold text-gray-900">
                  {t("auditTrail")}
                </h4>
                <div className="space-y-2">
                  {/* Created */}
                  <AuditRow
                    label={t("createdAt")}
                    date={selectedClaim.createdAt}
                    actor={selectedClaim.createdBy}
                  />
                  {/* Reviewed */}
                  {selectedClaim.reviewedAt && (
                    <AuditRow
                      label={t("reviewedAt")}
                      date={selectedClaim.reviewedAt}
                      actor={selectedClaim.reviewedBy}
                      comment={selectedClaim.reviewComment}
                    />
                  )}
                  {/* Approved */}
                  {selectedClaim.approvedAt && (
                    <AuditRow
                      label={t("approvedAt")}
                      date={selectedClaim.approvedAt}
                      actor={selectedClaim.approvedBy}
                      comment={selectedClaim.approvalComment}
                    />
                  )}
                  {/* Rejected */}
                  {selectedClaim.rejectedAt && (
                    <AuditRow
                      label={t("rejectedAt")}
                      date={selectedClaim.rejectedAt}
                      actor={selectedClaim.rejectedBy}
                      comment={selectedClaim.rejectionReason}
                    />
                  )}
                  {/* Reimbursed */}
                  {selectedClaim.reimbursedAt && (
                    <AuditRow
                      label={t("reimbursedAt")}
                      date={selectedClaim.reimbursedAt}
                      actor={selectedClaim.reimbursedBy}
                    />
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedClaim(null)}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                >
                  {t("cancel") || "Close"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== ACTION CONFIRMATION MODALS ==================== */}
        {actionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-lg">
              <h2 className="text-lg font-semibold text-gray-900">
                {actionModal.type === "submit" && t("submit")}
                {actionModal.type === "review" && t("reviewTitle")}
                {actionModal.type === "approve" && t("approveTitle")}
                {actionModal.type === "reject" && t("rejectTitle")}
                {actionModal.type === "reimburse" && t("reimburseTitle")}
                {actionModal.type === "delete" && t("delete")}
              </h2>

              {/* Claim summary */}
              <div className="rounded-lg bg-gray-50 p-3 text-sm">
                <p className="font-medium text-gray-900">{actionModal.claim.title}</p>
                <p className="text-gray-500">
                  {formatAmount(actionModal.claim.amount, actionModal.claim.currency)} · {formatDate(actionModal.claim.date)}
                </p>
              </div>

              {/* Submit confirm */}
              {actionModal.type === "submit" && (
                <p className="text-sm text-gray-600">{t("submitConfirm")}</p>
              )}

              {/* Delete confirm */}
              {actionModal.type === "delete" && (
                <p className="text-sm text-gray-600">{t("deleteConfirm")}</p>
              )}

              {/* Payment method & reference for reimburse */}
              {actionModal.type === "reimburse" && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t("paymentMethod")} *
                    </label>
                    <select
                      value={reimburseMethod}
                      onChange={(e) => setReimburseMethod(e.target.value as "Transfer" | "Cash" | "Online")}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
                    >
                      <option value="Transfer">{t("methodTransfer")}</option>
                      <option value="Cash">{t("methodCash")}</option>
                      <option value="Online">{t("methodOnline")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t("paymentReference")}
                    </label>
                    <input
                      type="text"
                      value={reimburseReference}
                      onChange={(e) => setReimburseReference(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
                    />
                  </div>
                </>
              )}

              {/* Comment for review / approve / reimburse */}
              {(actionModal.type === "review" ||
                actionModal.type === "approve" ||
                actionModal.type === "reimburse") && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {actionModal.type === "reimburse" ? t("notes") : t("comment")}
                  </label>
                  <textarea
                    value={actionComment}
                    onChange={(e) => setActionComment(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
                  />
                </div>
              )}

              {/* Reason for reject (required) */}
              {actionModal.type === "reject" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("reason")} *
                  </label>
                  <textarea
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    rows={3}
                    placeholder={t("reasonPlaceholder")}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
                  />
                </div>
              )}

              {/* Buttons */}
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={() => {
                    setActionModal(null);
                    setActionComment("");
                    setActionReason("");
                    setReimburseMethod("Transfer");
                    setReimburseReference("");
                  }}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                >
                  {t("cancel") || "Cancel"}
                </button>
                <button
                  onClick={handleAction}
                  disabled={
                    submitting || (actionModal.type === "reject" && !actionReason.trim())
                  }
                  className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    actionModal.type === "delete" || actionModal.type === "reject"
                      ? "bg-red-600 hover:bg-red-700"
                      : actionModal.type === "approve"
                        ? "bg-green-600 hover:bg-green-700"
                        : actionModal.type === "reimburse"
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : "bg-orange-600 hover:bg-orange-700"
                  }`}
                >
                  {submitting ? (
                    <span className="inline-flex items-center">
                      <span className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                      …
                    </span>
                  ) : actionModal.type === "submit" ? (
                    t("submit")
                  ) : actionModal.type === "review" ? (
                    t("review")
                  ) : actionModal.type === "approve" ? (
                    t("approve")
                  ) : actionModal.type === "reject" ? (
                    t("reject")
                  ) : actionModal.type === "reimburse" ? (
                    t("reimburse")
                  ) : (
                    t("delete")
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

/* ---------- Audit Trail Row ---------- */

function AuditRow({
  label,
  date,
  actor,
  comment,
}: {
  label: string;
  date: string;
  actor: string | null;
  comment?: string | null;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
      <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-orange-400" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium text-gray-900">{label}</span>
          <span className="text-gray-400">{formatDate(date)}</span>
          {actor && <span className="text-gray-500">— {actor}</span>}
        </div>
        {comment && <p className="mt-0.5 text-gray-600">{comment}</p>}
      </div>
    </div>
  );
}
