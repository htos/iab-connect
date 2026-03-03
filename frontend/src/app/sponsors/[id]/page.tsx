"use client";

/**
 * Sponsor Detail Page
 */

import { useAuth, useApiClient } from "@/lib/auth";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { SponsorDetailDto, SponsorStatus } from "@/types/sponsors";

const statusStyles: Record<SponsorStatus, string> = {
  Prospect: "bg-blue-100 text-blue-800",
  Active: "bg-green-100 text-green-800",
  Paused: "bg-yellow-100 text-yellow-800",
  Ended: "bg-gray-100 text-gray-800",
};

const tierStyles: Record<string, string> = {
  Bronze: "bg-amber-100 text-amber-800",
  Silver: "bg-gray-200 text-gray-700",
  Gold: "bg-yellow-100 text-yellow-800",
  Platinum: "bg-purple-100 text-purple-800",
};

export default function SponsorDetailPage() {
  const { isAuthenticated, isLoading: authLoading, isVorstand, isAdmin } = useAuth();
  const api = useApiClient();
  const router = useRouter();
  const params = useParams();
  const sponsorId = params.id as string;
  const t = useTranslations();

  const [sponsor, setSponsor] = useState<SponsorDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Package CRUD state
  const [showAddPackage, setShowAddPackage] = useState(false);
  const [pkgName, setPkgName] = useState("");
  const [pkgDescription, setPkgDescription] = useState("");
  const [pkgAmount, setPkgAmount] = useState("");
  const [pkgCurrency, setPkgCurrency] = useState("CHF");
  const [pkgSubmitting, setPkgSubmitting] = useState(false);
  const [removingPackageId, setRemovingPackageId] = useState<string | null>(null);

  // Contract Link CRUD state
  const [showAddLink, setShowAddLink] = useState(false);
  const [linkType, setLinkType] = useState<"Document" | "Invoice" | "Event">("Document");
  const [linkTargetId, setLinkTargetId] = useState("");
  const [linkDescription, setLinkDescription] = useState("");
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [removingLinkId, setRemovingLinkId] = useState<string | null>(null);

  const fetchSponsor = useCallback(async () => {
    if (!sponsorId) return;

    setLoading(true);
    setError(null);

    const result = await api.get<SponsorDetailDto>(`/api/v1/sponsors/${sponsorId}`);

    if (result.status === 404) {
      setError(t("sponsors.notFound"));
    } else if (result.error) {
      setError(result.error);
    } else {
      setSponsor(result.data);
    }

    setLoading(false);
  }, [api, sponsorId, t]);

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

  useEffect(() => {
    if (isAuthenticated && (isVorstand || isAdmin)) {
      fetchSponsor();
    }
  }, [isAuthenticated, isVorstand, isAdmin, fetchSponsor]);

  const handleStatusChange = async (newStatus: SponsorStatus) => {
    if (!sponsor) return;

    setStatusUpdating(true);
    try {
      const result = await api.put<SponsorDetailDto>(
        `/api/v1/sponsors/${sponsorId}/status`,
        { status: newStatus }
      );

      if (result.error) {
        alert(result.error);
      } else if (result.data) {
        setSponsor(result.data);
      }
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!sponsor) return;

    const result = await api.delete(`/api/v1/sponsors/${sponsorId}`);

    if (result.error) {
      alert(result.error);
    } else {
      router.push("/sponsors");
    }
  };

  const handleAddPackage = async () => {
    if (!pkgName.trim()) return;
    setPkgSubmitting(true);
    try {
      const result = await api.post<SponsorDetailDto>(`/api/v1/sponsors/${sponsorId}/packages`, {
        name: pkgName.trim(),
        description: pkgDescription.trim() || null,
        amount: pkgAmount ? parseFloat(pkgAmount) : null,
        currency: pkgCurrency || null,
      });
      if (result.error) {
        alert(result.error);
      } else if (result.data) {
        setSponsor(result.data);
        setPkgName("");
        setPkgDescription("");
        setPkgAmount("");
        setPkgCurrency("CHF");
        setShowAddPackage(false);
      }
    } finally {
      setPkgSubmitting(false);
    }
  };

  const handleRemovePackage = async (packageId: string) => {
    setRemovingPackageId(packageId);
    try {
      const result = await api.delete<SponsorDetailDto>(`/api/v1/sponsors/${sponsorId}/packages/${packageId}`);
      if (result.error) {
        alert(result.error);
      } else if (result.data) {
        setSponsor(result.data);
      }
    } finally {
      setRemovingPackageId(null);
    }
  };

  const handleAddLink = async () => {
    if (!linkTargetId.trim()) return;
    setLinkSubmitting(true);
    try {
      const result = await api.post<SponsorDetailDto>(`/api/v1/sponsors/${sponsorId}/links`, {
        linkType,
        targetId: linkTargetId.trim(),
        description: linkDescription.trim() || null,
      });
      if (result.error) {
        alert(result.error);
      } else if (result.data) {
        setSponsor(result.data);
        setLinkType("Document");
        setLinkTargetId("");
        setLinkDescription("");
        setShowAddLink(false);
      }
    } finally {
      setLinkSubmitting(false);
    }
  };

  const handleRemoveLink = async (linkId: string) => {
    setRemovingLinkId(linkId);
    try {
      const result = await api.delete<SponsorDetailDto>(`/api/v1/sponsors/${sponsorId}/links/${linkId}`);
      if (result.error) {
        alert(result.error);
      } else if (result.data) {
        setSponsor(result.data);
      }
    } finally {
      setRemovingLinkId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || (!isVorstand && !isAdmin)) {
    return null;
  }

  if (error) {
    return (
      <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
        <div className="max-w-2xl mx-auto">
          <Link
            href="/sponsors"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t("common.backToList")}
          </Link>
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-red-700 mb-2">{t("common.error")}</h2>
            <p className="text-red-600">{error}</p>
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

  const hasAddress = sponsor.street || sponsor.city || sponsor.postalCode || sponsor.country;

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <Link
              href="/sponsors"
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {t("common.backToList")}
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              {sponsor.companyName}
            </h1>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/sponsors/${sponsorId}/edit`}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {t("common.edit")}
            </Link>
            {isAdmin && (
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {t("common.delete")}
              </button>
            )}
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex flex-col items-center text-center">
                <div className="h-24 w-24 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                  <span className="text-3xl font-bold text-orange-600">
                    {initials}
                  </span>
                </div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {sponsor.companyName}
                </h2>
                {sponsor.contactPerson && (
                  <p className="text-gray-500 mb-2">{sponsor.contactPerson}</p>
                )}

                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${statusStyles[sponsor.status]}`}>
                    {t(`sponsors.status.${sponsor.status}`)}
                  </span>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${tierStyles[sponsor.tier] ?? "bg-gray-100 text-gray-800"}`}>
                    {sponsor.tier}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="md:col-span-2 space-y-6">
            {/* Contact Info */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("sponsors.contactInfo")}</h3>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">{t("members.email")}</dt>
                  <dd className="mt-1">
                    {sponsor.email ? (
                      <a href={`mailto:${sponsor.email}`} className="text-blue-600 hover:underline">
                        {sponsor.email}
                      </a>
                    ) : (
                      <span className="text-gray-400">–</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">{t("members.phone")}</dt>
                  <dd className="mt-1">
                    {sponsor.phone ? (
                      <a href={`tel:${sponsor.phone}`} className="text-blue-600 hover:underline">
                        {sponsor.phone}
                      </a>
                    ) : (
                      <span className="text-gray-400">–</span>
                    )}
                  </dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">{t("sponsors.website")}</dt>
                  <dd className="mt-1">
                    {sponsor.website ? (
                      <a
                        href={sponsor.website.startsWith("http") ? sponsor.website : `https://${sponsor.website}`}
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
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("sponsors.address")}</h3>
                <address className="not-italic text-gray-700">
                  {sponsor.street && <>{sponsor.street}<br /></>}
                  {(sponsor.postalCode || sponsor.city) && (
                    <>{sponsor.postalCode} {sponsor.city}<br /></>
                  )}
                  {sponsor.country}
                </address>
              </div>
            )}

            {/* Sponsor Info */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("sponsors.sponsorInfo")}</h3>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">{t("sponsors.tier")}</dt>
                  <dd className="mt-1 text-gray-900">{sponsor.tier}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">{t("sponsors.statusLabel")}</dt>
                  <dd className="mt-1 text-gray-900">{t(`sponsors.status.${sponsor.status}`)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">{t("sponsors.agreementStart")}</dt>
                  <dd className="mt-1 text-gray-900">
                    {sponsor.agreementStart
                      ? new Date(sponsor.agreementStart).toLocaleDateString("de-CH", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })
                      : <span className="text-gray-400">–</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">{t("sponsors.agreementEnd")}</dt>
                  <dd className="mt-1 text-gray-900">
                    {sponsor.agreementEnd
                      ? new Date(sponsor.agreementEnd).toLocaleDateString("de-CH", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })
                      : <span className="text-gray-400">–</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">{t("sponsors.packages")}</dt>
                  <dd className="mt-1 text-gray-900">{sponsor.packages.length}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">{t("sponsors.contractLinksSection")}</dt>
                  <dd className="mt-1 text-gray-900">{sponsor.contractLinks.length}</dd>
                </div>
                {sponsor.notes && (
                  <div className="md:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">{t("sponsors.notes")}</dt>
                    <dd className="mt-1 text-gray-900 whitespace-pre-wrap">{sponsor.notes}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("sponsors.quickActions")}</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("sponsors.changeStatus")}
                </label>
                <select
                  value={sponsor.status}
                  onChange={(e) => handleStatusChange(e.target.value as SponsorStatus)}
                  disabled={statusUpdating}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:opacity-50"
                >
                  <option value="Prospect">{t("sponsors.status.Prospect")}</option>
                  <option value="Active">{t("sponsors.status.Active")}</option>
                  <option value="Paused">{t("sponsors.status.Paused")}</option>
                  <option value="Ended">{t("sponsors.status.Ended")}</option>
                </select>
              </div>
            </div>

            {/* Packages Section */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{t("sponsors.packagesSection")}</h3>
                <button
                  onClick={() => setShowAddPackage(!showAddPackage)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showAddPackage ? "M6 18L18 6M6 6l12 12" : "M12 4v16m8-8H4"} />
                  </svg>
                  {showAddPackage ? t("common.cancel") : t("sponsors.addPackage")}
                </button>
              </div>

              {/* Add Package Form */}
              {showAddPackage && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t("sponsors.packageName")} *</label>
                      <input
                        type="text"
                        value={pkgName}
                        onChange={(e) => setPkgName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
                        placeholder={t("sponsors.packageName")}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t("sponsors.packageDescription")}</label>
                      <input
                        type="text"
                        value={pkgDescription}
                        onChange={(e) => setPkgDescription(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
                        placeholder={t("sponsors.packageDescription")}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t("sponsors.packageAmount")}</label>
                      <input
                        type="number"
                        step="0.01"
                        value={pkgAmount}
                        onChange={(e) => setPkgAmount(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t("sponsors.packageCurrency")}</label>
                      <select
                        value={pkgCurrency}
                        onChange={(e) => setPkgCurrency(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
                      >
                        <option value="CHF">CHF</option>
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                        <option value="INR">INR</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end mt-3">
                    <button
                      onClick={handleAddPackage}
                      disabled={!pkgName.trim() || pkgSubmitting}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
                    >
                      {pkgSubmitting ? t("common.loading") : t("sponsors.addPackage")}
                    </button>
                  </div>
                </div>
              )}

              {sponsor.packages.length === 0 && !showAddPackage ? (
                <p className="text-gray-500">{t("sponsors.noPackages")}</p>
              ) : sponsor.packages.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="pb-3 text-sm font-medium text-gray-500">{t("sponsors.packageName")}</th>
                        <th className="pb-3 text-sm font-medium text-gray-500">{t("sponsors.packageDescription")}</th>
                        <th className="pb-3 text-sm font-medium text-gray-500 text-right">{t("sponsors.packageAmount")}</th>
                        <th className="pb-3 text-sm font-medium text-gray-500 text-right">{t("sponsors.actions")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sponsor.packages.map((pkg) => (
                        <tr key={pkg.id}>
                          <td className="py-3 text-gray-900">{pkg.name}</td>
                          <td className="py-3 text-gray-600">{pkg.description ?? "–"}</td>
                          <td className="py-3 text-gray-900 text-right">
                            {pkg.amount != null
                              ? `${pkg.amount.toLocaleString("de-CH", { minimumFractionDigits: 2 })} ${pkg.currency ?? ""}`
                              : "–"}
                          </td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => handleRemovePackage(pkg.id)}
                              disabled={removingPackageId === pkg.id}
                              className="text-sm text-red-600 hover:text-red-800 transition-colors disabled:opacity-50"
                            >
                              {removingPackageId === pkg.id ? "..." : t("sponsors.removePackage")}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>

            {/* Contract Links Section */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{t("sponsors.contractLinksSection")}</h3>
                <button
                  onClick={() => setShowAddLink(!showAddLink)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showAddLink ? "M6 18L18 6M6 6l12 12" : "M12 4v16m8-8H4"} />
                  </svg>
                  {showAddLink ? t("common.cancel") : t("sponsors.addLink")}
                </button>
              </div>

              {/* Add Link Form */}
              {showAddLink && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t("sponsors.linkType")}</label>
                      <select
                        value={linkType}
                        onChange={(e) => setLinkType(e.target.value as "Document" | "Invoice" | "Event")}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
                      >
                        <option value="Document">Document</option>
                        <option value="Invoice">Invoice</option>
                        <option value="Event">Event</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t("sponsors.linkTargetId")} *</label>
                      <input
                        type="text"
                        value={linkTargetId}
                        onChange={(e) => setLinkTargetId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
                        placeholder={t("sponsors.linkTargetId")}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t("sponsors.linkDescription")}</label>
                      <input
                        type="text"
                        value={linkDescription}
                        onChange={(e) => setLinkDescription(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
                        placeholder={t("sponsors.linkDescription")}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end mt-3">
                    <button
                      onClick={handleAddLink}
                      disabled={!linkTargetId.trim() || linkSubmitting}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
                    >
                      {linkSubmitting ? t("common.loading") : t("sponsors.addLink")}
                    </button>
                  </div>
                </div>
              )}

              {sponsor.contractLinks.length === 0 && !showAddLink ? (
                <p className="text-gray-500">{t("sponsors.noLinks")}</p>
              ) : sponsor.contractLinks.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="pb-3 text-sm font-medium text-gray-500">{t("sponsors.linkType")}</th>
                        <th className="pb-3 text-sm font-medium text-gray-500">{t("sponsors.linkDescription")}</th>
                        <th className="pb-3 text-sm font-medium text-gray-500">{t("sponsors.linkCreated")}</th>
                        <th className="pb-3 text-sm font-medium text-gray-500 text-right">{t("sponsors.actions")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sponsor.contractLinks.map((link) => (
                        <tr key={link.id}>
                          <td className="py-3 text-gray-900">{link.linkType}</td>
                          <td className="py-3 text-gray-600">{link.description ?? "–"}</td>
                          <td className="py-3 text-gray-500">
                            {new Date(link.createdAt).toLocaleDateString("de-CH", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })}
                          </td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => handleRemoveLink(link.id)}
                              disabled={removingLinkId === link.id}
                              className="text-sm text-red-600 hover:text-red-800 transition-colors disabled:opacity-50"
                            >
                              {removingLinkId === link.id ? "..." : t("sponsors.removeLink")}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowDeleteDialog(false)} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              {t("sponsors.confirmDeleteTitle")}
            </h2>
            <p className="text-gray-600 mb-6">
              {t("sponsors.confirmDelete", { name: sponsor.companyName })}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                {t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
