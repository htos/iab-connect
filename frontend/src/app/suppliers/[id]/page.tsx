"use client";

/**
 * Supplier Detail Page
 */

import { useAuth, useApiClient } from "@/lib/auth";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type {
  SupplierDetailDto,
  SupplierStatus,
} from "@/features/suppliers/types/supplier.types";

const statusStyles: Record<SupplierStatus, string> = {
  Prospect: "bg-blue-100 text-blue-800",
  Active: "bg-green-100 text-green-800",
  Paused: "bg-yellow-100 text-yellow-800",
  Ended: "bg-gray-100 text-gray-800",
};

export default function SupplierDetailPage() {
  const { isAuthenticated, isLoading: authLoading, isAdmin } = useAuth();
  const api = useApiClient();
  const router = useRouter();
  const params = useParams();
  const supplierId = params.id as string;
  const t = useTranslations();

  const [supplier, setSupplier] = useState<SupplierDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Contract Link CRUD state
  const [showAddLink, setShowAddLink] = useState(false);
  const [linkType, setLinkType] = useState<"Document" | "Invoice" | "Event">("Document");
  const [linkTargetId, setLinkTargetId] = useState("");
  const [linkDescription, setLinkDescription] = useState("");
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [removingLinkId, setRemovingLinkId] = useState<string | null>(null);

  const fetchSupplier = useCallback(async () => {
    if (!supplierId) return;

    setLoading(true);
    setError(null);

    const result = await api.get<SupplierDetailDto>(`/api/v1/suppliers/${supplierId}`);

    if (result.status === 404) {
      setError(t("suppliers.notFound"));
    } else if (result.error) {
      setError(result.error);
    } else {
      setSupplier(result.data);
    }

    setLoading(false);
  }, [api, supplierId, t]);

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

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchSupplier();
    }
  }, [isAuthenticated, isAdmin, fetchSupplier]);

  const handleStatusChange = async (newStatus: SupplierStatus) => {
    if (!supplier) return;

    setStatusUpdating(true);
    try {
      const result = await api.put<SupplierDetailDto>(
        `/api/v1/suppliers/${supplierId}/status`,
        { status: newStatus }
      );

      if (result.error) {
        alert(result.error);
      } else if (result.data) {
        setSupplier(result.data);
      }
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!supplier) return;

    const result = await api.delete(`/api/v1/suppliers/${supplierId}`);

    if (result.error) {
      alert(result.error);
    } else {
      router.push("/suppliers");
    }
  };

  const handleAddLink = async () => {
    if (!linkTargetId.trim()) return;
    setLinkSubmitting(true);
    try {
      const result = await api.post<SupplierDetailDto>(`/api/v1/suppliers/${supplierId}/links`, {
        linkType,
        targetId: linkTargetId.trim(),
        description: linkDescription.trim() || null,
      });
      if (result.error) {
        alert(result.error);
      } else if (result.data) {
        setSupplier(result.data);
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
      const result = await api.delete<SupplierDetailDto>(`/api/v1/suppliers/${supplierId}/links/${linkId}`);
      if (result.error) {
        alert(result.error);
      } else if (result.data) {
        setSupplier(result.data);
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

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  if (error) {
    return (
      <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
        <div className="max-w-2xl mx-auto">
          <Link
            href="/suppliers"
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

  if (!supplier) {
    return null;
  }

  const initials = supplier.companyName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const hasAddress = supplier.street || supplier.city || supplier.postalCode || supplier.country;

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <Link
              href="/suppliers"
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {t("common.backToList")}
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              {supplier.companyName}
            </h1>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/suppliers/${supplierId}/edit`}
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
                  {supplier.companyName}
                </h2>
                {supplier.contactPerson && (
                  <p className="text-gray-500 mb-2">{supplier.contactPerson}</p>
                )}

                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${statusStyles[supplier.status]}`}>
                    {t(`suppliers.status.${supplier.status}`)}
                  </span>
                  {supplier.category && (
                    <span className="px-3 py-1 text-sm font-medium rounded-full bg-indigo-100 text-indigo-800">
                      {supplier.category}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="md:col-span-2 space-y-6">
            {/* Contact Info */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("suppliers.contactInfo")}</h3>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">{t("members.email")}</dt>
                  <dd className="mt-1">
                    {supplier.email ? (
                      <a href={`mailto:${supplier.email}`} className="text-blue-600 hover:underline">
                        {supplier.email}
                      </a>
                    ) : (
                      <span className="text-gray-400">–</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">{t("members.phone")}</dt>
                  <dd className="mt-1">
                    {supplier.phone ? (
                      <a href={`tel:${supplier.phone}`} className="text-blue-600 hover:underline">
                        {supplier.phone}
                      </a>
                    ) : (
                      <span className="text-gray-400">–</span>
                    )}
                  </dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">{t("suppliers.website")}</dt>
                  <dd className="mt-1">
                    {supplier.website ? (
                      <a
                        href={supplier.website.startsWith("http") ? supplier.website : `https://${supplier.website}`}
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
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("suppliers.address")}</h3>
                <address className="not-italic text-gray-700">
                  {supplier.street && <>{supplier.street}<br /></>}
                  {(supplier.postalCode || supplier.city) && (
                    <>{supplier.postalCode} {supplier.city}<br /></>
                  )}
                  {supplier.country}
                </address>
              </div>
            )}

            {/* Supplier Info */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("suppliers.supplierInfo")}</h3>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">{t("suppliers.category")}</dt>
                  <dd className="mt-1 text-gray-900">{supplier.category ?? <span className="text-gray-400">–</span>}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">{t("suppliers.statusLabel")}</dt>
                  <dd className="mt-1 text-gray-900">{t(`suppliers.status.${supplier.status}`)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">{t("suppliers.contractLinksSection")}</dt>
                  <dd className="mt-1 text-gray-900">{supplier.contractLinks.length}</dd>
                </div>
                {supplier.notes && (
                  <div className="md:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">{t("suppliers.notes")}</dt>
                    <dd className="mt-1 text-gray-900 whitespace-pre-wrap">{supplier.notes}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("suppliers.quickActions")}</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("suppliers.changeStatus")}
                </label>
                <select
                  value={supplier.status}
                  onChange={(e) => handleStatusChange(e.target.value as SupplierStatus)}
                  disabled={statusUpdating}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:opacity-50"
                >
                  <option value="Prospect">{t("suppliers.status.Prospect")}</option>
                  <option value="Active">{t("suppliers.status.Active")}</option>
                  <option value="Paused">{t("suppliers.status.Paused")}</option>
                  <option value="Ended">{t("suppliers.status.Ended")}</option>
                </select>
              </div>
            </div>

            {/* Contract Links Section */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{t("suppliers.contractLinksSection")}</h3>
                <button
                  onClick={() => setShowAddLink(!showAddLink)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showAddLink ? "M6 18L18 6M6 6l12 12" : "M12 4v16m8-8H4"} />
                  </svg>
                  {showAddLink ? t("common.cancel") : t("suppliers.addLink")}
                </button>
              </div>

              {/* Add Link Form */}
              {showAddLink && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t("suppliers.linkType")}</label>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t("suppliers.linkTargetId")} *</label>
                      <input
                        type="text"
                        value={linkTargetId}
                        onChange={(e) => setLinkTargetId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
                        placeholder={t("suppliers.linkTargetId")}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t("suppliers.linkDescription")}</label>
                      <input
                        type="text"
                        value={linkDescription}
                        onChange={(e) => setLinkDescription(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
                        placeholder={t("suppliers.linkDescription")}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end mt-3">
                    <button
                      onClick={handleAddLink}
                      disabled={!linkTargetId.trim() || linkSubmitting}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
                    >
                      {linkSubmitting ? t("common.loading") : t("suppliers.addLink")}
                    </button>
                  </div>
                </div>
              )}

              {supplier.contractLinks.length === 0 && !showAddLink ? (
                <p className="text-gray-500">{t("suppliers.noLinks")}</p>
              ) : supplier.contractLinks.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="pb-3 text-sm font-medium text-gray-500">{t("suppliers.linkType")}</th>
                        <th className="pb-3 text-sm font-medium text-gray-500">{t("suppliers.linkDescription")}</th>
                        <th className="pb-3 text-sm font-medium text-gray-500">{t("suppliers.linkCreated")}</th>
                        <th className="pb-3 text-sm font-medium text-gray-500 text-right">{t("common.actions")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {supplier.contractLinks.map((link) => (
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
                              {removingLinkId === link.id ? "..." : t("suppliers.removeLink")}
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
              {t("suppliers.confirmDeleteTitle")}
            </h2>
            <p className="text-gray-600 mb-6">
              {t("suppliers.confirmDelete", { name: supplier.companyName })}
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
