"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useSponsor, SponsorNotFoundError } from "../hooks/use-sponsor";
import { useSponsorDetailMutations } from "../hooks/use-sponsor-detail-mutations";
import { useDeleteSponsor } from "../hooks/use-delete-sponsor";
import { SponsorStatusBadge } from "./sponsor-status-badge";
import { SponsorTierBadge } from "./sponsor-tier-badge";
import { SponsorPackages } from "./sponsor-packages";
import { SponsorContractLinks } from "./sponsor-contract-links";
import { DeleteSponsorDialog } from "./delete-sponsor-dialog";
import type { SponsorStatus } from "../types/sponsor.types";

/**
 * Sponsor detail composition root (E22-S3, DEC-2=A) — the only `"use client"`
 * boundary for `/sponsors/[id]`. The GET is a TanStack query (`use-sponsor`); the
 * status change + inline package/link CRUD are `useMutation`s
 * (`use-sponsor-detail-mutations`) that write the returned `SponsorDetailDto`
 * back into the detail cache (no extra GET, A79); delete reuses the list's
 * `use-delete-sponsor` and redirects. Every endpoint, pending state, and empty
 * state from the god-page is preserved (the E22-S1 detail suite is the contract).
 * Mutation errors are surfaced via `alert`, exactly as before.
 */
export function SponsorDetail() {
  const {
    isAuthenticated,
    isLoading: authLoading,
    isVorstand,
    isAdmin,
  } = useAuth();
  const router = useRouter();
  const params = useParams();
  const sponsorId = params.id as string;
  const t = useTranslations();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }
    if (!authLoading && isAuthenticated && !isVorstand && !isAdmin) {
      router.push("/");
      return;
    }
  }, [authLoading, isAuthenticated, isVorstand, isAdmin, router]);

  const {
    data: sponsor,
    isLoading: loading,
    error: queryError,
  } = useSponsor(sponsorId, isAuthenticated && (isVorstand || isAdmin));
  const mutations = useSponsorDetailMutations(sponsorId);
  const deleteMutation = useDeleteSponsor();

  const handleStatusChange = (newStatus: SponsorStatus) => {
    mutations.changeStatus.mutate(newStatus, {
      onError: (e) => alert(e.message),
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate(sponsorId, {
      onSuccess: () => router.push("/sponsors"),
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

  if (!isAuthenticated || (!isVorstand && !isAdmin)) {
    return null;
  }

  if (queryError) {
    const message =
      queryError instanceof SponsorNotFoundError
        ? t("sponsors.notFound")
        : queryError.message;
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
        <div className="mx-auto max-w-2xl">
          <Link
            href="/sponsors"
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
        </div>
      </main>
    );
  }

  if (!sponsor) {
    return null;
  }

  const initials = sponsor.companyName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const hasAddress =
    sponsor.street || sponsor.city || sponsor.postalCode || sponsor.country;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link
              href="/sponsors"
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
              {sponsor.companyName}
            </h1>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/sponsors/${sponsorId}/edit`}
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
                  {sponsor.companyName}
                </h2>
                {sponsor.contactPerson && (
                  <p className="mb-2 text-gray-500">{sponsor.contactPerson}</p>
                )}

                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  <SponsorStatusBadge status={sponsor.status} />
                  <SponsorTierBadge tier={sponsor.tier} />
                </div>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-6 md:col-span-2">
            {/* Contact Info */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">
                {t("sponsors.contactInfo")}
              </h3>
              <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    {t("members.email")}
                  </dt>
                  <dd className="mt-1">
                    {sponsor.email ? (
                      <a
                        href={`mailto:${sponsor.email}`}
                        className="text-blue-600 hover:underline"
                      >
                        {sponsor.email}
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
                    {sponsor.phone ? (
                      <a
                        href={`tel:${sponsor.phone}`}
                        className="text-blue-600 hover:underline"
                      >
                        {sponsor.phone}
                      </a>
                    ) : (
                      <span className="text-gray-400">–</span>
                    )}
                  </dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">
                    {t("sponsors.website")}
                  </dt>
                  <dd className="mt-1">
                    {sponsor.website ? (
                      <a
                        href={
                          sponsor.website.startsWith("http")
                            ? sponsor.website
                            : `https://${sponsor.website}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {sponsor.website}
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
                  {t("sponsors.address")}
                </h3>
                <address className="text-gray-700 not-italic">
                  {sponsor.street && (
                    <>
                      {sponsor.street}
                      <br />
                    </>
                  )}
                  {(sponsor.postalCode || sponsor.city) && (
                    <>
                      {sponsor.postalCode} {sponsor.city}
                      <br />
                    </>
                  )}
                  {sponsor.country}
                </address>
              </div>
            )}

            {/* Sponsor Info */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">
                {t("sponsors.sponsorInfo")}
              </h3>
              <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    {t("sponsors.tier")}
                  </dt>
                  <dd className="mt-1 text-gray-900">{sponsor.tier}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    {t("sponsors.statusLabel")}
                  </dt>
                  <dd className="mt-1 text-gray-900">
                    {t(`sponsors.status.${sponsor.status}`)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    {t("sponsors.agreementStart")}
                  </dt>
                  <dd className="mt-1 text-gray-900">
                    {sponsor.agreementStart ? (
                      new Date(sponsor.agreementStart).toLocaleDateString(
                        "de-CH",
                        {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        }
                      )
                    ) : (
                      <span className="text-gray-400">–</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    {t("sponsors.agreementEnd")}
                  </dt>
                  <dd className="mt-1 text-gray-900">
                    {sponsor.agreementEnd ? (
                      new Date(sponsor.agreementEnd).toLocaleDateString(
                        "de-CH",
                        {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        }
                      )
                    ) : (
                      <span className="text-gray-400">–</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    {t("sponsors.packages")}
                  </dt>
                  <dd className="mt-1 text-gray-900">
                    {sponsor.packages.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    {t("sponsors.contractLinksSection")}
                  </dt>
                  <dd className="mt-1 text-gray-900">
                    {sponsor.contractLinks.length}
                  </dd>
                </div>
                {sponsor.notes && (
                  <div className="md:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">
                      {t("sponsors.notes")}
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap text-gray-900">
                      {sponsor.notes}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Quick Actions */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">
                {t("sponsors.quickActions")}
              </h3>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  {t("sponsors.changeStatus")}
                </label>
                <select
                  value={sponsor.status}
                  onChange={(e) =>
                    handleStatusChange(e.target.value as SponsorStatus)
                  }
                  disabled={mutations.changeStatus.isPending}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                >
                  <option value="Prospect">
                    {t("sponsors.status.Prospect")}
                  </option>
                  <option value="Active">{t("sponsors.status.Active")}</option>
                  <option value="Paused">{t("sponsors.status.Paused")}</option>
                  <option value="Ended">{t("sponsors.status.Ended")}</option>
                </select>
              </div>
            </div>

            {/* Packages Section */}
            <SponsorPackages
              packages={sponsor.packages}
              addPackage={mutations.addPackage}
              removePackage={mutations.removePackage}
            />

            {/* Contract Links Section */}
            <SponsorContractLinks
              contractLinks={sponsor.contractLinks}
              addLink={mutations.addLink}
              removeLink={mutations.removeLink}
            />
          </div>
        </div>
      </div>

      <DeleteSponsorDialog
        target={
          showDeleteDialog ? { id: sponsorId, name: sponsor.companyName } : null
        }
        pending={deleteMutation.isPending}
        onConfirm={handleDelete}
        onOpenChange={(open) => {
          if (!open) setShowDeleteDialog(false);
        }}
      />
    </main>
  );
}
