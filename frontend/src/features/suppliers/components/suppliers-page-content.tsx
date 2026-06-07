"use client";

/**
 * Suppliers List Page content — REQ-032: Lieferantenverwaltung.
 *
 * Feature-slice composition root (E21-S3 pilot). The route file
 * `app/suppliers/page.tsx` is a thin entry that renders this component; this is
 * the single `"use client"` boundary. Data/mutations live in TanStack hooks
 * (`use-suppliers`, `use-delete-supplier`); URLs in `api/suppliers-api`.
 *
 * Behaviour preserved verbatim (pinned by the E21-S2 characterization suite):
 * admin-only access with the same redirects, server-side status filter,
 * client-side search, loading/error/empty states, list-refresh-after-delete.
 * The inline admin redirect is kept (Gate-1 Q8: moving it to `useRequireAuth`
 * changes redirect targets, so that is a deferred follow-up, not this pilot).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useSuppliers } from "../hooks/use-suppliers";
import { useDeleteSupplier } from "../hooks/use-delete-supplier";
import { SuppliersFilterBar } from "./suppliers-filter-bar";
import { SuppliersTable } from "./suppliers-table";
import { DeleteSupplierDialog } from "./delete-supplier-dialog";

export function SuppliersPageContent() {
  const { isAuthenticated, isLoading: authLoading, isAdmin } = useAuth();
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
    if (!authLoading && isAuthenticated && !isAdmin) router.push("/");
  }, [authLoading, isAuthenticated, isAdmin, router]);

  const {
    data: suppliers = [],
    isLoading: loading,
    error,
  } = useSuppliers(statusFilter, isAuthenticated && isAdmin);
  const deleteMutation = useDeleteSupplier();

  // Delete error takes precedence over a stale list-query error (matches the old
  // god-page, where a failed delete's setError overwrote the banner). The mutation
  // error is cleared on the next filter/search interaction below.
  const errorMessage = deleteMutation.error?.message ?? error?.message ?? null;

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSettled: () => setDeleteTarget(null),
    });
  };

  const filteredSuppliers = suppliers.filter((s) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      s.companyName.toLowerCase().includes(term) ||
      (s.contactPerson?.toLowerCase().includes(term) ?? false) ||
      (s.email?.toLowerCase().includes(term) ?? false) ||
      (s.category?.toLowerCase().includes(term) ?? false)
    );
  });

  if (authLoading || !isAdmin) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
        <div className="mx-auto flex max-w-7xl justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-orange-600" />
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
              {t("suppliers.title")}
            </h1>
            <p className="mt-1 text-gray-600">{t("suppliers.subtitle")}</p>
          </div>
          <Link
            href="/suppliers/new"
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700"
          >
            + {t("suppliers.create")}
          </Link>
        </div>

        <SuppliersFilterBar
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
        ) : filteredSuppliers.length === 0 ? (
          <div className="rounded-xl bg-white p-12 text-center shadow-sm">
            <p className="text-lg font-medium text-gray-500">
              {t("suppliers.empty")}
            </p>
          </div>
        ) : (
          <SuppliersTable
            suppliers={filteredSuppliers}
            onDelete={setDeleteTarget}
          />
        )}
      </div>

      <DeleteSupplierDialog
        target={deleteTarget}
        pending={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      />
    </main>
  );
}
