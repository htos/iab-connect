"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/layout";
import { useSupplier, SupplierNotFoundError } from "../hooks/use-supplier";
import { useSupplierDetailMutations } from "../hooks/use-supplier-detail-mutations";
import { useDeleteSupplier } from "../hooks/use-delete-supplier";
import { SupplierStatusBadge } from "./supplier-status-badge";
import { SupplierContractLinks } from "./supplier-contract-links";
import { DeleteSupplierDialog } from "./delete-supplier-dialog";
import type { SupplierStatus } from "../types/supplier.types";

/**
 * Supplier detail composition root (E22-S4) — the only `"use client"` boundary
 * for `/suppliers/[id]`, completing the E21 pilot. The GET is a TanStack query
 * (`use-supplier`); status change + inline contract-link CRUD are `useMutation`s
 * (`use-supplier-detail-mutations`) that write the returned `SupplierDetailDto`
 * back into the detail cache (no extra GET, A79); delete reuses the list's
 * `use-delete-supplier` and redirects. Admin-only. Suppliers have NO packages and
 * use `category` (a free-text badge) instead of `tier`. Mutation errors surface
 * via `alert`, exactly as before.
 */
export function SupplierDetail() {
  const { isAuthenticated, isLoading: authLoading, isAdmin } = useAuth();
  const router = useRouter();
  const params = useParams();
  const supplierId = params.id as string;
  const t = useTranslations();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }
    if (!authLoading && isAuthenticated && !isAdmin) {
      router.push("/");
      return;
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  const {
    data: supplier,
    isLoading: loading,
    error: queryError,
  } = useSupplier(supplierId, isAuthenticated && isAdmin);
  const mutations = useSupplierDetailMutations(supplierId);
  const deleteMutation = useDeleteSupplier();

  const handleStatusChange = (newStatus: SupplierStatus) => {
    mutations.changeStatus.mutate(newStatus, {
      onError: (e) => alert(e.message),
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate(supplierId, {
      onSuccess: () => router.push("/suppliers"),
      onError: (e) => alert(e.message),
    });
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
          <p className="mt-4 text-gray-600">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  if (queryError) {
    const message =
      queryError instanceof SupplierNotFoundError
        ? t("suppliers.notFound")
        : queryError.message;
    return (
      <PageShell maxWidth="2xl">
        <Link
          href="/suppliers"
          className="mb-4 inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
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
          {t("common.backToList")}
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <h2 className="mb-2 text-xl font-semibold text-red-700">
            {t("common.error")}
          </h2>
          <p className="text-red-600">{message}</p>
        </div>
      </PageShell>
    );
  }

  if (!supplier) {
    return null;
  }

  const initials = supplier.companyName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const hasAddress =
    supplier.street || supplier.city || supplier.postalCode || supplier.country;

  return (
    <PageShell maxWidth="4xl">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Link
            href="/suppliers"
            className="mb-4 inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
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
            {t("common.backToList")}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
            {supplier.companyName}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/suppliers/${supplierId}/edit`}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 transition-colors hover:bg-gray-50"
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
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            {t("common.edit")}
          </Link>
          {isAdmin && (
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-red-100 px-4 py-2 text-red-700 transition-colors hover:bg-red-200"
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              {t("common.delete")}
            </button>
          )}
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Profile Card */}
        <div className="md:col-span-1">
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-orange-100">
                <span className="text-3xl font-bold text-orange-600">
                  {initials}
                </span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                {supplier.companyName}
              </h2>
              {supplier.contactPerson && (
                <p className="mb-2 text-gray-500">{supplier.contactPerson}</p>
              )}

              <div className="mt-2 flex flex-wrap justify-center gap-2">
                <SupplierStatusBadge status={supplier.status} />
                {supplier.category && (
                  <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-800">
                    {supplier.category}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-6 md:col-span-2">
          {/* Contact Info */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              {t("suppliers.contactInfo")}
            </h3>
            <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  {t("members.email")}
                </dt>
                <dd className="mt-1">
                  {supplier.email ? (
                    <a
                      href={`mailto:${supplier.email}`}
                      className="text-blue-600 hover:underline"
                    >
                      {supplier.email}
                    </a>
                  ) : (
                    <span className="text-gray-400">–</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  {t("members.phone")}
                </dt>
                <dd className="mt-1">
                  {supplier.phone ? (
                    <a
                      href={`tel:${supplier.phone}`}
                      className="text-blue-600 hover:underline"
                    >
                      {supplier.phone}
                    </a>
                  ) : (
                    <span className="text-gray-400">–</span>
                  )}
                </dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-sm font-medium text-gray-500">
                  {t("suppliers.website")}
                </dt>
                <dd className="mt-1">
                  {supplier.website ? (
                    <a
                      href={
                        supplier.website.startsWith("http")
                          ? supplier.website
                          : `https://${supplier.website}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {supplier.website}
                    </a>
                  ) : (
                    <span className="text-gray-400">–</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          {/* Address */}
          {hasAddress && (
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">
                {t("suppliers.address")}
              </h3>
              <address className="text-gray-700 not-italic">
                {supplier.street && (
                  <>
                    {supplier.street}
                    <br />
                  </>
                )}
                {(supplier.postalCode || supplier.city) && (
                  <>
                    {supplier.postalCode} {supplier.city}
                    <br />
                  </>
                )}
                {supplier.country}
              </address>
            </div>
          )}

          {/* Supplier Info */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              {t("suppliers.supplierInfo")}
            </h3>
            <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  {t("suppliers.category")}
                </dt>
                <dd className="mt-1 text-gray-900">
                  {supplier.category ?? (
                    <span className="text-gray-400">–</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  {t("suppliers.statusLabel")}
                </dt>
                <dd className="mt-1 text-gray-900">
                  {t(`suppliers.status.${supplier.status}`)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  {t("suppliers.contractLinksSection")}
                </dt>
                <dd className="mt-1 text-gray-900">
                  {supplier.contractLinks.length}
                </dd>
              </div>
              {supplier.notes && (
                <div className="md:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">
                    {t("suppliers.notes")}
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap text-gray-900">
                    {supplier.notes}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              {t("suppliers.quickActions")}
            </h3>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                {t("suppliers.changeStatus")}
              </label>
              <select
                value={supplier.status}
                onChange={(e) =>
                  handleStatusChange(e.target.value as SupplierStatus)
                }
                disabled={mutations.changeStatus.isPending}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
              >
                <option value="Prospect">
                  {t("suppliers.status.Prospect")}
                </option>
                <option value="Active">{t("suppliers.status.Active")}</option>
                <option value="Paused">{t("suppliers.status.Paused")}</option>
                <option value="Ended">{t("suppliers.status.Ended")}</option>
              </select>
            </div>
          </div>

          {/* Contract Links Section */}
          <SupplierContractLinks
            contractLinks={supplier.contractLinks}
            addLink={mutations.addLink}
            removeLink={mutations.removeLink}
          />
        </div>
      </div>

      <DeleteSupplierDialog
        target={
          showDeleteDialog
            ? { id: supplierId, name: supplier.companyName }
            : null
        }
        pending={deleteMutation.isPending}
        onConfirm={handleDelete}
        onOpenChange={(open) => {
          if (!open) setShowDeleteDialog(false);
        }}
      />
    </PageShell>
  );
}
