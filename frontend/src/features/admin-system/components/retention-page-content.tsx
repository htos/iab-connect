"use client";

/**
 * Retention Policies page content (E27-S4). Feature-slice composition root; the
 * route file is a thin entry rendering this — the single `"use client"` boundary.
 *
 * Behaviour preserved verbatim (pinned by the E27-S1 retention net): the admin
 * auth guard (non-admin → `router.push("/")` + `return null`; fetch gated on
 * `isAuthenticated && isAdmin && accessToken`), the policy list + read-only
 * dataCategory display, the action badge, the inline edit form (now RHF+Zod via
 * `RetentionForm`) → save (`updateRetentionPolicy`) + success toast (auto-dismiss
 * 5s), the enforce action (no confirm, orange) + result count, and
 * loading/error/empty. Server-state moves to `useRetention`; the save/enforce to
 * `useUpdateRetention`/`useEnforceRetention` (invalidate-on-success, A79).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PageShell } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { useRetention } from "../hooks/use-retention";
import {
  useEnforceRetention,
  useUpdateRetention,
} from "../hooks/use-retention-mutations";
import { RetentionForm } from "./retention-form";
import { RetentionActionBadge } from "./retention-badges";
import type {
  RetentionPolicyDto,
  UpdateRetentionPolicyRequest,
} from "../types/retention.types";

export function RetentionPageContent() {
  const t = useTranslations("admin.retention");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const {
    isAuthenticated,
    isLoading: authLoading,
    isAdmin,
    accessToken,
  } = useAuth();

  const gated = Boolean(isAuthenticated && isAdmin && accessToken);

  const { data, isLoading, error: loadError } = useRetention(gated);
  const updateRetention = useUpdateRetention();
  const enforceRetention = useEnforceRetention();

  const policies = data ?? [];

  // Action error (save/enforce) only; the LOAD error is DERIVED from the query
  // below (no server-state mirror via effect). `actionError` stays dismissable via
  // the banner's close button.
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const error =
    actionError ??
    (loadError
      ? loadError instanceof Error
        ? loadError.message
        : t("errors.loadFailed")
      : null);

  // Redirect if not admin.
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  // Auto-dismiss success messages after 5s.
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const startEdit = (policy: RetentionPolicyDto) => setEditingId(policy.id);
  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (
    id: string,
    formData: UpdateRetentionPolicyRequest
  ) => {
    setActionError(null);
    try {
      await updateRetention.mutateAsync({ id, data: formData });
      setSuccessMessage(t("updateSuccess"));
      setEditingId(null);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : t("errors.updateFailed")
      );
    }
  };

  const handleEnforce = async () => {
    setActionError(null);
    try {
      const result = await enforceRetention.mutateAsync();
      setSuccessMessage(
        t("enforceSuccess", { count: result.processedRecords })
      );
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : t("errors.enforceFailed")
      );
    }
  };

  const formatRetention = (months: number): string => {
    if (months >= 12 && months % 12 === 0) {
      return t("years", { count: months / 12 });
    }
    return t("months", { count: months });
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  return (
    <PageShell>
      <Link
        href="/admin"
        className="mb-6 inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        {t("backToAdmin")}
      </Link>

      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-1 text-gray-600">{t("subtitle")}</p>
        </div>
        <button
          onClick={handleEnforce}
          disabled={enforceRetention.isPending}
          className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-white hover:bg-orange-700 focus:ring-2 focus:ring-orange-500 focus:outline-none disabled:opacity-50"
        >
          {enforceRetention.isPending ? (
            <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white"></div>
          ) : (
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          )}
          {t("enforceNow")}
        </button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4">
          <svg
            className="h-5 w-5 shrink-0 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-green-800">{successMessage}</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4">
          <svg
            className="h-5 w-5 shrink-0 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-red-800">{error}</span>
          <button
            onClick={() => setActionError(null)}
            className="ml-auto text-red-600 hover:text-red-800"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Info Banner */}
      <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <svg
            className="mt-0.5 h-5 w-5 shrink-0 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm text-blue-800">{t("infoText")}</p>
        </div>
      </div>

      {/* Policy Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
        </div>
      ) : policies.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <p className="text-gray-500">{t("noPolicies")}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {policies.map((policy) => (
            <div
              key={policy.id}
              className={`rounded-xl bg-white p-6 shadow-sm ${!policy.isActive ? "opacity-60" : ""}`}
            >
              {editingId === policy.id ? (
                <RetentionForm
                  policy={policy}
                  isSaving={updateRetention.isPending}
                  onSubmit={(formData) => saveEdit(policy.id, formData)}
                  onCancel={cancelEdit}
                />
              ) : (
                /* Display Mode */
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {policy.displayName}
                      </h3>
                      <RetentionActionBadge
                        action={policy.action}
                        label={t(`actions.${policy.action.toLowerCase()}`)}
                      />
                      {!policy.isActive && (
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                          {t("inactive")}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
                      <span>
                        {t("fields.category")}:{" "}
                        <strong>{policy.dataCategory}</strong>
                      </span>
                      <span>
                        {t("fields.retention")}:{" "}
                        <strong>
                          {formatRetention(policy.retentionMonths)}
                        </strong>
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
                    className="flex shrink-0 items-center gap-2 rounded-xl bg-orange-50 px-4 py-2 text-sm text-orange-600 hover:bg-orange-100"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    {tCommon("edit")}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
