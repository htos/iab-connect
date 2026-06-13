"use client";

/**
 * Edit-email-template page content (REQ-026, E25-S4). Thin client composition root
 * rendered by `[id]/page.tsx`. KEEPS `useParams()` inside the slice (the S1 spec
 * mocks `next/navigation.useParams`) so the route entry stays trivial; `id =
 * Number(params.id)` (NUMERIC). Owns the auth guard, the detail load, the update
 * mutation + success banner + ~1.5s redirect; the relocated `EmailTemplateForm`
 * owns the fields/validation/variables sub-editor.
 *
 * Behaviour preserved (pinned by the E25-S1 edit net):
 *   - reads the id via `useParams()` as a NUMBER → `getTemplateById(id, accessToken)`;
 *   - `authLoading || loading` → spinner (loading starts true; the SILENT-null guard
 *     is reached only after the prefill load resolves);
 *   - the SILENT-null guard `!isAuthenticated || (!isAdmin && !isVorstand)` →
 *     `return null` (NOT a router redirect);
 *   - the prefilled form; on save → `updateTemplate(id, data, accessToken)` → the
 *     `form.saveSuccess` banner → a ~1.5s `router.push("/communication/email-templates")`;
 *   - the save error message surfaced (no redirect);
 *   - the `templateNotFound` surface (A93 — the query's not-found sentinel / a
 *     settled-empty load) and the `loadError` banner on a generic load failure.
 */

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/layout";
import { EmailTemplateForm } from "./email-template-form";
import {
  EmailTemplateNotFoundError,
  useEmailTemplate,
} from "../hooks/use-email-template";
import { useUpdateEmailTemplate } from "../hooks/use-update-email-template";
import type { UpdateEmailTemplateRequest } from "../types/email-template.types";

export function EmailTemplateEditContent() {
  const router = useRouter();
  const params = useParams();
  const {
    accessToken,
    isLoading: authLoading,
    isAuthenticated,
    isAdmin,
    isVorstand,
  } = useAuth();
  const t = useTranslations("emailTemplates");
  const tCommon = useTranslations("common");
  const id = Number(params.id);

  const {
    data: template,
    isLoading: queryLoading,
    error: loadError,
  } = useEmailTemplate(id, !!accessToken);

  const updateMutation = useUpdateEmailTemplate();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSave = async (data: UpdateEmailTemplateRequest) => {
    setError(null);
    try {
      await updateMutation.mutateAsync({ id, body: data });
      setSuccess(t("form.saveSuccess"));
      setTimeout(() => {
        router.push("/communication/email-templates");
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("form.saveError"));
    }
  };

  // Loading spinner (god-page: `authLoading || loading`). The `!accessToken` term
  // mirrors the list page (`showSpinner = !accessToken || queryLoading`): the detail
  // query is `enabled`-gated on the token, so a disabled query reports `isLoading:
  // false` (TanStack v5) — without this term a no-token route would fall through to
  // the silent-null guard instead of the god-page's preserved stuck spinner.
  if (authLoading || !accessToken || queryLoading) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
            <p className="mt-4 text-gray-600">{tCommon("loading")}</p>
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated || (!isAdmin && !isVorstand)) {
    return null;
  }

  // Template not found (A93 — the not-found sentinel, or a settled-empty load).
  const isNotFound =
    loadError instanceof EmailTemplateNotFoundError ||
    (!template && !loadError);
  if (isNotFound) {
    return (
      <PageShell maxWidth="4xl">
        <Link
          href="/communication/email-templates"
          className="mb-6 inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {t("backToTemplates")}
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-red-700">{t("templateNotFound")}</p>
        </div>
      </PageShell>
    );
  }

  // A generic load failure (not a 404 sentinel) surfaces the loadError banner. The
  // god-page + the list page surface the actual server/ApiError message
  // (`err.message`), only falling back to the generic key for a non-Error throw.
  const bannerError =
    error ?? (loadError instanceof Error ? loadError.message : null);

  return (
    <PageShell maxWidth="4xl">
      {/* Back link */}
      <Link
        href="/communication/email-templates"
        className="mb-6 inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
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
            d="M15 19l-7-7 7-7"
          />
        </svg>
        {t("backToTemplates")}
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
          {t("editTitle")}
        </h1>
        <p className="mt-1 text-gray-600">{t("editSubtitle")}</p>
      </div>

      {/* Error Alert */}
      {bannerError && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-red-700">{bannerError}</p>
        </div>
      )}

      {/* Success Alert */}
      {success && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {/* Form content wrapped in card */}
      {template && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <EmailTemplateForm
            template={template}
            onSave={handleSave}
            isSaving={updateMutation.isPending}
          />
        </div>
      )}
    </PageShell>
  );
}
