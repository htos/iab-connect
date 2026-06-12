"use client";

/**
 * Email-campaigns LIST page content (REQ-026, E25-S3). Feature-slice composition
 * root rendered by the thin `communication/email-campaigns/page.tsx` route entry;
 * this is the single `"use client"` boundary for the list surface.
 *
 * Behaviour preserved verbatim (pinned by the E25-S1 list characterization net):
 * the list is visible to `isVorstand || isAdmin` with the same /login + / redirects
 * and NO fetch for unauthorised users; server-side `status` filtering (changing it
 * resets page→1) + pagination via the TanStack list key; purely client-side search;
 * the per-row Draft-only Edit/Delete affordances; the delete confirm→DELETE→refetch
 * flow with the god-page's `alert(server message || deleteError)` on failure
 * (A76 — NOT silently sticky); the loadError banner; the empty row; pagination.
 *
 * The "no access token → stays on the spinner" behaviour is preserved by gating the
 * query `enabled` on the token and rendering the spinner while the authorised load
 * has not resolved (the god-page's `fetchCampaigns` bailed before `setLoading(false)`
 * when the token was missing, so `loading` stayed true).
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useEmailCampaigns } from "../hooks/use-email-campaigns";
import { useDeleteEmailCampaign } from "../hooks/use-delete-email-campaign";
import { EmailCampaignsFilterBar } from "./email-campaigns-filter-bar";
import { EmailCampaignsTable } from "./email-campaigns-table";
import type { EmailCampaignStatus } from "../types/email-campaign.types";

export function EmailCampaignsPageContent() {
  const t = useTranslations("emailCampaigns");
  const {
    isAuthenticated,
    isLoading: authLoading,
    isVorstand,
    isAdmin,
    accessToken,
  } = useAuth();
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<EmailCampaignStatus | "">(
    ""
  );
  const [searchTerm, setSearchTerm] = useState("");

  const authorized = isVorstand || isAdmin;
  const enabled = !!accessToken && authorized;

  // Auth check (kept verbatim from the god-page).
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
    if (!authLoading && isAuthenticated && !isVorstand && !isAdmin) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isVorstand, isAdmin, router]);

  const {
    data,
    isLoading: queryLoading,
    error,
  } = useEmailCampaigns({ page, pageSize: 10, status: statusFilter }, enabled);

  const deleteMutation = useDeleteEmailCampaign();

  const totalPages = data?.totalPages ?? 1;
  const totalCount = data?.totalCount ?? 0;

  // Derive `campaigns` inside the memo so its dependency is the stable query `data`
  // (not a fresh `?? []` array each render). Client-side search mirrors the god-page.
  const filteredCampaigns = useMemo(() => {
    const campaigns = data?.items ?? [];
    if (!searchTerm.trim()) return campaigns;
    const term = searchTerm.toLowerCase();
    return campaigns.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.subject.toLowerCase().includes(term) ||
        c.status.toLowerCase().includes(term) ||
        (c.createdByName && c.createdByName.toLowerCase().includes(term))
    );
  }, [data, searchTerm]);

  const handleDelete = (id: string, name: string) => {
    if (!confirm(t("deleteConfirm", { name }))) return;
    deleteMutation.mutate(id, {
      // god-page parity: alert the server message, falling back to `deleteError`
      // when the failed delete carried no message (the thrown Error's message is
      // empty in that case).
      onError: (err) =>
        alert(
          err instanceof Error && err.message ? err.message : t("deleteError")
        ),
    });
  };

  // god-page parity: the spinner shows while auth is resolving OR while the
  // authorised list load is still pending OR when the token has not arrived yet
  // (the old `fetchCampaigns` bailed before clearing `loading` on a missing token).
  const showSpinner =
    authLoading || (authorized && (!accessToken || queryLoading));

  if (showSpinner) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
          <p className="mt-4 text-gray-600">{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (!isVorstand && !isAdmin) {
    return null;
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
            <p className="mt-1 text-gray-600">
              {t("totalCampaigns", { count: totalCount })}
            </p>
          </div>
          <Link
            href="/communication/email-campaigns/new"
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
            {t("newCampaign")}
          </Link>
        </div>

        <EmailCampaignsFilterBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          statusFilter={statusFilter}
          onStatusChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
        />

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error instanceof Error ? error.message : t("loadError")}
          </div>
        )}

        {/* Campaign List */}
        <EmailCampaignsTable
          campaigns={filteredCampaigns}
          onDelete={handleDelete}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("previous")}
            </button>
            <span className="text-gray-600">
              {t("pagination", { current: page, total: totalPages })}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("next")}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
