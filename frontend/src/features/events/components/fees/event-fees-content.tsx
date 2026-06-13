"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/layout";
import { formatCurrency } from "@/lib/utils";
import type {
  EventFeeCategoryDto,
  SaveFeeCategoryRequest,
} from "../../types/events.types";
import { FEE_CURRENCIES } from "../../types/events.types";
import { useEventFeeCategories } from "../../hooks/use-event-fee-categories";
import { useFeeCategoryMutations } from "../../hooks/use-fee-category-mutations";
import { FeeFormDialog, type FeeFormTarget } from "./fee-form-dialog";
import { formatZurich, utcIsoToZurichLocalInput } from "./datetime-zurich";

/**
 * Event fee-category management composition root (E24-S3) — the only
 * `"use client"` boundary for `/events/[id]/fees`. Behaviour-preserving (A79)
 * copy of the god-page: the active+retired list, the `noCategories` empty state,
 * the RHF+Zod create/edit dialog, the `confirm()`-gated deactivate, the
 * Zurich↔UTC availability conversion, the `loadFailed`/`saveFailed` banners, and
 * the role guard (`isVorstand || isAdmin || event-manager || kassier`) + the
 * `/login` redirect. The only delta is transport: the manual
 * `useState`+`useEffect` GET and the inline service calls are replaced by
 * `useEventFeeCategories()` + `useFeeCategoryMutations()`.
 */
export function EventFeesContent({ id: eventId }: { id: string }) {
  const router = useRouter();
  const t = useTranslations("events.fees");
  const {
    isAuthenticated,
    isLoading: authLoading,
    isVorstand,
    isAdmin,
    roles: userRoles,
  } = useAuth();
  const isEventManager = userRoles.includes("event-manager");
  const isKassier = userRoles.includes("kassier");
  const canManage = isVorstand || isAdmin || isEventManager || isKassier;

  const [error, setError] = useState<string | null>(null);
  const [formTarget, setFormTarget] = useState<FeeFormTarget | null>(null);
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // The query is enabled only once authenticated AND can-manage (god-page gate).
  // A79 note: with TanStack a disabled query reports `isLoading=false`, so a
  // non-manager now falls through the skeleton to the `permissionDenied` alert
  // instead of the god-page's skeleton-forever (a latent quirk). The manager
  // path — the only behaviour the S1 oracle exercises — is unchanged.
  const {
    data: categories = [],
    isLoading: loading,
    isError,
  } = useEventFeeCategories(eventId, isAuthenticated && canManage);

  const { create, update, deactivate } = useFeeCategoryMutations(eventId);

  // Surface a failed load as the god-page's `loadFailed` banner.
  useEffect(() => {
    if (isError) setError(t("loadFailed"));
  }, [isError, t]);

  const { active, inactive } = useMemo(() => {
    return {
      active: categories.filter((c) => c.isActive),
      inactive: categories.filter((c) => !c.isActive),
    };
  }, [categories]);

  const openCreate = useCallback(() => {
    setFormTarget({
      mode: "create",
      initial: {
        name: "",
        description: "",
        amount: 0,
        currency: FEE_CURRENCIES[0],
        applicability: "Everyone",
        availableFrom: "",
        availableUntil: "",
        maxQuantity: "",
      },
    });
  }, []);

  const openEdit = useCallback((c: EventFeeCategoryDto) => {
    setFormTarget({
      mode: "edit",
      categoryId: c.id,
      initial: {
        name: c.name,
        description: c.description ?? "",
        amount: c.amount,
        currency: c.currency as (typeof FEE_CURRENCIES)[number],
        applicability: c.applicability,
        availableFrom: c.availableFrom
          ? utcIsoToZurichLocalInput(c.availableFrom)
          : "",
        availableUntil: c.availableUntil
          ? utcIsoToZurichLocalInput(c.availableUntil)
          : "",
        maxQuantity: c.maxQuantity != null ? String(c.maxQuantity) : "",
      },
    });
  }, []);

  // Bridge the dialog submit to the create/update mutation. Returns the saved
  // DTO (truthy) on success or null on failure, preserving the god-page's
  // `res.data ? onSaved() : onError()` branch.
  const handleSave = useCallback(
    async (target: FeeFormTarget, payload: SaveFeeCategoryRequest) => {
      if (target.categoryId) {
        return update.mutateAsync({
          categoryId: target.categoryId,
          body: payload,
        });
      }
      return create.mutateAsync(payload);
    },
    [create, update]
  );

  const handleDeactivate = useCallback(
    async (categoryId: string) => {
      if (!confirm(t("confirmDeactivate"))) return;
      setActionInFlight(categoryId);
      try {
        await deactivate.mutateAsync(categoryId);
      } catch {
        setError(t("saveFailed"));
      } finally {
        setActionInFlight(null);
      }
    },
    [deactivate, t]
  );

  if (authLoading || loading) {
    return (
      <PageShell maxWidth="5xl">
        <div className="mb-6 h-8 w-64 animate-pulse rounded bg-gray-200" />
        <div className="h-96 animate-pulse rounded-xl bg-gray-200" />
      </PageShell>
    );
  }

  if (!isAuthenticated) return null;

  if (!canManage) {
    return (
      <PageShell maxWidth="5xl">
        <div
          role="alert"
          className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-yellow-800"
        >
          {t("permissionDenied")}
        </div>
      </PageShell>
    );
  }

  const renderRow = (c: EventFeeCategoryDto) => (
    <tr key={c.id} className="border-b last:border-0">
      <td className="py-2 font-medium text-gray-900">{c.name}</td>
      <td className="py-2">{formatCurrency(c.amount, c.currency)}</td>
      <td className="py-2">{t(`applicabilityOptions.${c.applicability}`)}</td>
      <td className="py-2 text-gray-600">
        {c.availableFrom || c.availableUntil ? (
          <>
            {c.availableFrom ? formatZurich(c.availableFrom) : "–"}
            {" → "}
            {c.availableUntil ? formatZurich(c.availableUntil) : "–"}
          </>
        ) : (
          t("alwaysAvailable")
        )}
      </td>
      <td className="py-2 text-right">
        {c.isActive ? (
          <>
            <button
              type="button"
              onClick={() => openEdit(c)}
              className="mr-3 text-sm font-medium text-orange-700 hover:text-orange-800"
            >
              {t("edit")}
            </button>
            <button
              type="button"
              onClick={() => handleDeactivate(c.id)}
              disabled={actionInFlight === c.id}
              className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              {t("deactivate")}
            </button>
          </>
        ) : (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
            {t("retired")}
          </span>
        )}
      </td>
    </tr>
  );

  return (
    <PageShell maxWidth="5xl">
      <Link
        href={`/events/${eventId}`}
        className="mb-6 inline-flex items-center gap-2 text-gray-600 transition-colors hover:text-orange-600"
      >
        ← {t("backToEvent")}
      </Link>

      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("pageTitle")}</h1>
          <p className="mt-1 text-gray-500">{t("pageDescription")}</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700"
        >
          {t("newCategory")}
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-4 flex justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="font-medium"
          >
            ×
          </button>
        </div>
      )}

      {formTarget && (
        <FeeFormDialog
          key={formTarget.categoryId ?? "new"}
          target={formTarget}
          onClose={() => setFormTarget(null)}
          onSave={handleSave}
          onError={(message) => setError(message)}
        />
      )}

      {active.length === 0 && inactive.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center text-gray-500 shadow-sm">
          {t("noCategories")}
        </div>
      ) : (
        <section className="mb-4 rounded-xl bg-white p-4 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2">{t("name")}</th>
                <th className="py-2">{t("amount")}</th>
                <th className="py-2">{t("applicability")}</th>
                <th className="py-2">{t("availability")}</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {active.map(renderRow)}
              {inactive.map(renderRow)}
            </tbody>
          </table>
        </section>
      )}
    </PageShell>
  );
}
