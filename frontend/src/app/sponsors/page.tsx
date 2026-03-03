"use client";

import { useAuth, useApiClient } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type {
  SponsorListDto,
  SponsorStatus,
  SponsorTier,
} from "@/types/sponsors";

export default function SponsorsPage() {
  const { isAuthenticated, isLoading: authLoading, isVorstand, isAdmin } = useAuth();
  const api = useApiClient();
  const router = useRouter();
  const t = useTranslations();

  const [sponsors, setSponsors] = useState<SponsorListDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
    if (!authLoading && isAuthenticated && !isVorstand && !isAdmin) router.push("/");
  }, [authLoading, isAuthenticated, isVorstand, isAdmin, router]);

  const fetchSponsors = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = statusFilter ? `?status=${statusFilter}` : "";
    const result = await api.get<SponsorListDto[]>(`/api/v1/sponsors${params}`);
    if (result.error) {
      setError(result.error);
    } else {
      setSponsors(result.data ?? []);
    }
    setLoading(false);
  }, [api, statusFilter]);

  useEffect(() => {
    if (isAuthenticated && (isVorstand || isAdmin)) {
      fetchSponsors();
    }
  }, [isAuthenticated, isVorstand, isAdmin, fetchSponsors]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const result = await api.delete(`/api/v1/sponsors/${deleteTarget.id}`);
    if (result.error) {
      setError(result.error);
    } else {
      fetchSponsors();
    }
    setDeleteTarget(null);
  };

  const getStatusBadge = (status: SponsorStatus) => {
    const styles: Record<SponsorStatus, string> = {
      Prospect: "bg-blue-100 text-blue-800",
      Active: "bg-green-100 text-green-800",
      Paused: "bg-yellow-100 text-yellow-800",
      Ended: "bg-gray-100 text-gray-800",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {t(`sponsors.status.${status}`)}
      </span>
    );
  };

  const getTierBadge = (tier: SponsorTier) => {
    const styles: Record<SponsorTier, string> = {
      Bronze: "bg-amber-100 text-amber-800",
      Silver: "bg-gray-200 text-gray-700",
      Gold: "bg-yellow-100 text-yellow-800",
      Platinum: "bg-purple-100 text-purple-800",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[tier]}`}>
        {tier}
      </span>
    );
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
      <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
        <div className="max-w-7xl mx-auto flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{t("sponsors.title")}</h1>
            <p className="text-gray-600 mt-1">{t("sponsors.subtitle")}</p>
          </div>
          <Link
            href="/sponsors/new"
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 transition-colors"
          >
            + {t("sponsors.create")}
          </Link>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder={t("sponsors.searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors bg-white"
            >
              <option value="">{t("sponsors.allStatuses")}</option>
              <option value="Prospect">{t("sponsors.status.Prospect")}</option>
              <option value="Active">{t("sponsors.status.Active")}</option>
              <option value="Paused">{t("sponsors.status.Paused")}</option>
              <option value="Ended">{t("sponsors.status.Ended")}</option>
            </select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
          </div>
        ) : filteredSponsors.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <p className="text-lg font-medium text-gray-500">{t("sponsors.empty")}</p>
          </div>
        ) : (
          /* Table */
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t("sponsors.companyName")}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t("sponsors.contactPerson")}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t("sponsors.tier")}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t("sponsors.statusLabel")}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t("sponsors.packages")}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t("sponsors.actions")}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredSponsors.map((sponsor) => (
                    <tr key={sponsor.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link href={`/sponsors/${sponsor.id}`} className="text-orange-600 hover:text-orange-700 font-medium">
                          {sponsor.companyName}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {sponsor.contactPerson ?? "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getTierBadge(sponsor.tier)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(sponsor.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {sponsor.packageCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <Link href={`/sponsors/${sponsor.id}/edit`} className="text-orange-600 hover:text-orange-700 mr-3">
                          {t("common.edit")}
                        </Link>
                        {isAdmin && (
                          <button
                            onClick={() => setDeleteTarget({ id: sponsor.id, name: sponsor.companyName })}
                            className="text-red-600 hover:text-red-700"
                          >
                            {t("common.delete")}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

        {/* Delete Confirmation Dialog */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteTarget(null)} />
            <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                {t("sponsors.confirmDeleteTitle")}
              </h2>
              <p className="text-gray-600 mb-6">
                {t("sponsors.confirmDelete", { name: deleteTarget.name })}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={handleDelete}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition-colors"
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
