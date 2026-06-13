"use client";

/**
 * Sponsors List Page content — REQ-031: Sponsorenverwaltung.
 *
 * Feature-slice composition root (E22-S2, mirroring the E21-S3 suppliers pilot).
 * The route file `app/sponsors/page.tsx` is a thin entry that renders this
 * component; this is the single `"use client"` boundary. Data/mutations live in
 * TanStack hooks (`use-sponsors`, `use-delete-sponsor`); URLs in `api/sponsors-api`.
 *
 * Behaviour preserved verbatim (pinned by the E22-S1 list characterization
 * suite): the LIST is visible to `isVorstand || isAdmin` (NOT admin-only) with
 * the same redirects, the DELETE affordance is Admin-only, server-side status
 * filter, client-side search, loading/error/empty states, status badge AND tier
 * badge, list-refresh-after-delete, and the A76 delete-failure handling. The
 * inline auth redirect is kept verbatim (moving it to a shared hook would change
 * redirect targets — a deferred follow-up, not this story).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { PageShell, PageHeader } from "@/components/layout";
import { useSponsors } from "../hooks/use-sponsors";
import { useDeleteSponsor } from "../hooks/use-delete-sponsor";
import { SponsorsFilterBar } from "./sponsors-filter-bar";
import { SponsorsTable } from "./sponsors-table";
import { DeleteSponsorDialog } from "./delete-sponsor-dialog";

export function SponsorsPageContent() {
  const {
    isAuthenticated,
    isLoading: authLoading,
    isVorstand,
    isAdmin,
  } = useAuth();
  const router = useRouter();
  const t = useTranslations();

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
    if (!authLoading && isAuthenticated && !isVorstand && !isAdmin)
      router.push("/");
  }, [authLoading, isAuthenticated, isVorstand, isAdmin, router]);

  const {
    data: sponsors = [],
    isLoading: loading,
    error,
  } = useSponsors(statusFilter, isAuthenticated && (isVorstand || isAdmin));
  const deleteMutation = useDeleteSponsor();

  // Delete error takes precedence over a stale list-query error (matches the old
  // god-page, where a failed delete's setError overwrote the banner). The mutation
  // error is cleared on the next filter/search interaction below (E21 P3 fix).
  const errorMessage = deleteMutation.error?.message ?? error?.message ?? null;

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSettled: () => setDeleteTarget(null),
    });
  };

  const filteredSponsors = sponsors.filter((s) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      s.companyName.toLowerCase().includes(term) ||
      (s.contactPerson?.toLowerCase().includes(term) ?? false) ||
      (s.email?.toLowerCase().includes(term) ?? false)
    );
  });

  if (authLoading || (!isVorstand && !isAdmin)) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
        <div className="mx-auto flex max-w-7xl justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-orange-600" />
        </div>
      </main>
    );
  }

  return (
    <PageShell
      header={
        <PageHeader
          title={t("sponsors.title")}
          description={t("sponsors.subtitle")}
          actions={
            <Link
              href="/sponsors/new"
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700"
            >
              + {t("sponsors.create")}
            </Link>
          }
        />
      }
    >
      <SponsorsFilterBar
        searchTerm={searchTerm}
        onSearchChange={(value) => {
          if (deleteMutation.error) deleteMutation.reset();
          setSearchTerm(value);
        }}
        statusFilter={statusFilter}
        onStatusChange={(value) => {
          if (deleteMutation.error) deleteMutation.reset();
          setStatusFilter(value);
        }}
      />

      {errorMessage && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-orange-600" />
        </div>
      ) : filteredSponsors.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <p className="text-lg font-medium text-gray-500">
            {t("sponsors.empty")}
          </p>
        </div>
      ) : (
        <SponsorsTable
          sponsors={filteredSponsors}
          isAdmin={isAdmin}
          onDelete={setDeleteTarget}
        />
      )}

      <DeleteSponsorDialog
        target={deleteTarget}
        pending={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      />
    </PageShell>
  );
}
