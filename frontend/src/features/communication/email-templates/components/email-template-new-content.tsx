"use client";

/**
 * Create-email-template page content (REQ-026, E25-S4). Thin client composition
 * root rendered by `new/page.tsx`. Owns the auth guard, the create mutation +
 * success banner + ~1.5s redirect; the relocated `EmailTemplateForm` owns the
 * fields/validation/variables sub-editor.
 *
 * Behaviour preserved (pinned by the E25-S1 create net):
 *   - `authLoading` → spinner (no redirect);
 *   - the SILENT-null guard `!isAuthenticated || (!isAdmin && !isVorstand)` →
 *     `return null` (NOT a router redirect — distinct from the index page);
 *   - on save → `createTemplate(data, accessToken)` → the `form.createSuccess`
 *     banner → a ~1.5s delayed `router.push("/communication/email-templates")`;
 *   - the create error message surfaced in the banner (no redirect).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/layout";
import { EmailTemplateForm } from "./email-template-form";
import { useCreateEmailTemplate } from "../hooks/use-create-email-template";
import type { CreateEmailTemplateRequest } from "../types/email-template.types";

export function EmailTemplateNewContent() {
  const router = useRouter();
  const {
    isLoading: authLoading,
    isAuthenticated,
    isAdmin,
    isVorstand,
  } = useAuth();
  const t = useTranslations("emailTemplates");
  const tCommon = useTranslations("common");

  const createMutation = useCreateEmailTemplate();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSave = async (data: CreateEmailTemplateRequest) => {
    setError(null);
    try {
      await createMutation.mutateAsync(data);
      setSuccess(t("form.createSuccess"));
      setTimeout(() => {
        router.push("/communication/email-templates");
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("form.createError"));
    }
  };

  if (authLoading) {
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
          {t("newTitle")}
        </h1>
        <p className="mt-1 text-gray-600">{t("newSubtitle")}</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Success Alert */}
      {success && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {/* Form content wrapped in card */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <EmailTemplateForm
          onSave={handleSave}
          isSaving={createMutation.isPending}
        />
      </div>
    </PageShell>
  );
}
