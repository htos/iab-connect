"use client";

/**
 * Retention Policies Page
 * REQ-057: Datenaufbewahrung & Archivierung
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import {
  getRetentionPolicies,
  updateRetentionPolicy,
  enforceRetention,
  getActionColor,
  RetentionPolicyDto,
  UpdateRetentionPolicyRequest,
} from "@/lib/api/retention";

export default function RetentionPage() {
  const t = useTranslations("admin.retention");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, isAdmin, accessToken } = useAuth();

  // Data state
  const [policies, setPolicies] = useState<RetentionPolicyDto[]>([]);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isEnforcing, setIsEnforcing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<UpdateRetentionPolicyRequest | null>(null);

  // Fetch policies
  const fetchPolicies = useCallback(async () => {
    if (!accessToken) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await getRetentionPolicies(accessToken);
      setPolicies(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, t]);

  useEffect(() => {
    if (isAuthenticated && isAdmin && accessToken) {
      fetchPolicies();
    }
  }, [isAuthenticated, isAdmin, accessToken, fetchPolicies]);

  // Redirect if not admin
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  // Auto-dismiss success messages
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Start editing a policy
  const startEdit = (policy: RetentionPolicyDto) => {
    setEditingId(policy.id);
    setEditForm({
      displayName: policy.displayName,
      retentionMonths: policy.retentionMonths,
      action: policy.action,
      legalBasis: policy.legalBasis,
      isActive: policy.isActive,
    });
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  // Save edited policy
  const saveEdit = async () => {
    if (!accessToken || !editingId || !editForm) return;

    try {
      await updateRetentionPolicy(accessToken, editingId, editForm);
      setSuccessMessage(t("updateSuccess"));
      cancelEdit();
      await fetchPolicies();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.updateFailed"));
    }
  };

  // Manual enforcement
  const handleEnforce = async () => {
    if (!accessToken) return;

    setIsEnforcing(true);
    setError(null);

    try {
      const result = await enforceRetention(accessToken);
      setSuccessMessage(t("enforceSuccess", { count: result.processedRecords }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.enforceFailed"));
    } finally {
      setIsEnforcing(false);
    }
  };

  // Format retention period
  const formatRetention = (months: number): string => {
    if (months >= 12 && months % 12 === 0) {
      const years = months / 12;
      return t("years", { count: years });
    }
    return t("months", { count: months });
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t("backToAdmin")}
        </Link>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{t("title")}</h1>
            <p className="text-gray-600 mt-1">{t("subtitle")}</p>
          </div>
          <button
            onClick={handleEnforce}
            disabled={isEnforcing}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl flex items-center gap-2 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {isEnforcing ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {t("enforceNow")}
          </button>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-green-800">{successMessage}</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
            <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-800">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Info Banner */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-blue-800">{t("infoText")}</p>
          </div>
        </div>

        {/* Policy Cards */}
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
          </div>
        ) : policies.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <p className="text-gray-500">{t("noPolicies")}</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {policies.map((policy) => (
              <div
                key={policy.id}
                className={`bg-white rounded-xl shadow-sm p-6 ${!policy.isActive ? "opacity-60" : ""}`}
              >
                {editingId === policy.id && editForm ? (
                  /* Edit Mode */
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t("fields.displayName")}
                        </label>
                        <input
                          type="text"
                          value={editForm.displayName}
                          onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t("fields.retentionMonths")}
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={editForm.retentionMonths}
                          onChange={(e) =>
                            setEditForm({ ...editForm, retentionMonths: parseInt(e.target.value) || 1 })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t("fields.action")}
                        </label>
                        <select
                          value={editForm.action}
                          onChange={(e) => setEditForm({ ...editForm, action: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        >
                          <option value="Anonymize">{t("actions.anonymize")}</option>
                          <option value="Archive">{t("actions.archive")}</option>
                          <option value="Delete">{t("actions.delete")}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t("fields.legalBasis")}
                        </label>
                        <input
                          type="text"
                          value={editForm.legalBasis || ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, legalBasis: e.target.value || null })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editForm.isActive}
                          onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                          className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                        />
                        {t("fields.active")}
                      </label>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t">
                      <button
                        onClick={cancelEdit}
                        className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm"
                      >
                        {tCommon("cancel")}
                      </button>
                      <button
                        onClick={saveEdit}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm"
                      >
                        {tCommon("save")}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display Mode */
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{policy.displayName}</h3>
                        <span
                          className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getActionColor(policy.action)}`}
                        >
                          {t(`actions.${policy.action.toLowerCase()}`)}
                        </span>
                        {!policy.isActive && (
                          <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
                            {t("inactive")}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
                        <span>
                          {t("fields.category")}: <strong>{policy.dataCategory}</strong>
                        </span>
                        <span>
                          {t("fields.retention")}: <strong>{formatRetention(policy.retentionMonths)}</strong>
                        </span>
                        {policy.legalBasis && (
                          <span>
                            {t("fields.legalBasis")}: <em>{policy.legalBasis}</em>
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => startEdit(policy)}
                      className="px-4 py-2 text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-xl text-sm flex items-center gap-2 shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      {tCommon("edit")}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
