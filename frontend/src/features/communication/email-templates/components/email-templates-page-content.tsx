"use client";

/**
 * Email-templates LIST page content (REQ-026, E25-S4). Feature-slice composition
 * root rendered by the thin `communication/email-templates/page.tsx` route entry;
 * the single `"use client"` boundary for the list surface.
 *
 * Behaviour preserved verbatim (pinned by the E25-S1 list characterization net):
 *   - NO redirect guard — the list reads ONLY `useAuth().accessToken`. With no
 *     token the spinner is shown and NO fetch fires (the query is `enabled`-gated
 *     on the token, and the spinner shows while the token has not arrived). This
 *     reproduces the god-page's stuck-spinner exactly (do NOT "fix" it).
 *   - load via `getAllTemplates(accessToken)` → the card grid;
 *   - the category Badge + the inactive Badge (only when `!isActive`);
 *   - purely client-side search by name/description (case-insensitive);
 *   - the empty state (noSearchResults vs noTemplatesDescription + the
 *     create-first CTA);
 *   - the per-card destructive-RED Delete (A76) → native `confirm()` → DELETE:
 *     SUCCESS refetches (the row disappears via `invalidateQueries`), FAILURE keeps
 *     the row + surfaces the error banner, confirm-cancel skips the delete (A79
 *     mechanism delta — manual `templates.filter` → TanStack invalidate).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { useEmailTemplates } from "../hooks/use-email-templates";
import { useDeleteEmailTemplate } from "../hooks/use-delete-email-template";
import { EmailTemplatesSearchBar } from "./email-templates-search-bar";
import { EmailTemplateCard } from "./email-template-card";

export function EmailTemplatesPageContent() {
  const t = useTranslations("emailTemplates");
  const tCommon = useTranslations("common");
  const { accessToken } = useAuth();

  const [searchTerm, setSearchTerm] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data, isLoading: queryLoading, error } = useEmailTemplates();
  const deleteMutation = useDeleteEmailTemplate();

  // god-page parity: the list filtered `templates` in-memory by name/description.
  const filteredTemplates = useMemo(() => {
    const templates = data ?? [];
    const term = searchTerm.toLowerCase();
    return templates.filter(
      (tpl) =>
        tpl.name.toLowerCase().includes(term) ||
        tpl.description.toLowerCase().includes(term)
    );
  }, [data, searchTerm]);

  const handleDelete = (id: number) => {
    if (!confirm(t("confirmDelete"))) return;
    if (!accessToken) return;
    deleteMutation.mutate(id, {
      // god-page parity: on failure surface the server message (or the deleteError
      // fallback) in the banner; the cache is NOT mutated, so the row stays.
      onError: (err) =>
        setDeleteError(err instanceof Error ? err.message : t("deleteError")),
      onSuccess: () => setDeleteError(null),
    });
  };

  // god-page parity: `loading` started true and never cleared without a token, so
  // the spinner stays shown while the token has not arrived OR the load is pending.
  const showSpinner = !accessToken || queryLoading;

  // The banner surfaces the load error OR the last delete error (the god-page used a
  // single `error` state for both). A delete error keeps the message verbatim.
  const bannerError =
    deleteError ?? (error instanceof Error ? error.message : null);

  if (showSpinner) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-orange-600"></div>
            <span className="ml-3 text-gray-600">{tCommon("loading")}</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
              {t("title")}
            </h1>
            <p className="mt-1 text-gray-600">{t("subtitle")}</p>
          </div>
          <Link
            href="/communication/email-templates/new"
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            {t("createTemplate")}
          </Link>
        </div>

        {/* Error message */}
        {bannerError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-3">
              <svg
                className="h-5 w-5 text-red-600"
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
              <span className="text-red-700">{bannerError}</span>
            </div>
          </div>
        )}

        {/* Search */}
        <EmailTemplatesSearchBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />

        {/* Templates list */}
        <div className="grid gap-4">
          {filteredTemplates.map((template) => (
            <EmailTemplateCard
              key={template.id}
              template={template}
              onDelete={handleDelete}
            />
          ))}
        </div>

        {/* Empty state */}
        {filteredTemplates.length === 0 && (
          <div className="rounded-xl bg-white p-8 text-center shadow-sm">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              {t("noTemplates")}
            </h3>
            <p className="mt-2 text-gray-500">
              {searchTerm ? t("noSearchResults") : t("noTemplatesDescription")}
            </p>
            {!searchTerm && (
              <Link
                href="/communication/email-templates/new"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700"
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
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                {t("createFirstTemplate")}
              </Link>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
