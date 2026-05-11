"use client";

/**
 * REQ-026: E-Mail Kampagnen Liste
 * Accessible to Vorstand and Admin only
 */

import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  EmailCampaignDto,
  PagedResponse,
  EmailCampaignStatus,
  getStatusColor,
} from "@/lib/api/email-campaigns";

export default function EmailCampaignsPage() {
  const t = useTranslations("emailCampaigns");
  const { isAuthenticated, isLoading: authLoading, isVorstand, isAdmin, accessToken } = useAuth();
  const router = useRouter();

  const [campaigns, setCampaigns] = useState<EmailCampaignDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<EmailCampaignStatus | "">("");
  const [searchTerm, setSearchTerm] = useState("");

  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;

  const fetchCampaigns = useCallback(async (currentPage: number, status: string) => {
    const token = accessTokenRef.current;
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append("page", currentPage.toString());
      params.append("pageSize", "10");
      if (status) params.append("status", status);

      const response = await fetch(`${baseUrl}/api/v1/email-campaigns?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(t("loadError"));
      }

      const data: PagedResponse<EmailCampaignDto> = await response.json();
      setCampaigns(data.items);
      setTotalPages(data.totalPages);
      setTotalCount(data.totalCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("genericError"));
    } finally {
      setLoading(false);
    }
  }, [baseUrl, t]);

  // Auth check
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
    if (!authLoading && isAuthenticated && !isVorstand && !isAdmin) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isVorstand, isAdmin, router]);

  // Load campaigns
  useEffect(() => {
    if (accessToken && (isVorstand || isAdmin)) {
      fetchCampaigns(page, statusFilter);
    }
  }, [accessToken, isVorstand, isAdmin, page, statusFilter, fetchCampaigns]);

  const filteredCampaigns = useMemo(() => {
    if (!searchTerm.trim()) return campaigns;
    const term = searchTerm.toLowerCase();
    return campaigns.filter((c) =>
      c.name.toLowerCase().includes(term) ||
      c.subject.toLowerCase().includes(term) ||
      c.status.toLowerCase().includes(term) ||
      (c.createdByName && c.createdByName.toLowerCase().includes(term))
    );
  }, [campaigns, searchTerm]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t("deleteConfirm", { name }))) return;

    try {
      const response = await fetch(`${baseUrl}/api/v1/email-campaigns/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t("deleteError"));
      }

      fetchCampaigns(page, statusFilter);
    } catch (err) {
      alert(err instanceof Error ? err.message : t("deleteError"));
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (!isVorstand && !isAdmin) {
    return null;
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{t("title")}</h1>
            <p className="text-gray-600 mt-1">
              {t("totalCampaigns", { count: totalCount })}
            </p>
          </div>
          <Link
            href="/communication/email-campaigns/new"
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 transition-colors"
          >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t("newCampaign")}
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder={t("searchCampaigns")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("status")}</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as EmailCampaignStatus | "");
                setPage(1);
              }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors bg-white"
            >
              <option value="">{t("allStatuses")}</option>
              <option value="Draft">{t("statusDraft")}</option>
              <option value="Scheduled">{t("statusScheduled")}</option>
              <option value="Sending">{t("statusSending")}</option>
              <option value="Sent">{t("statusSent")}</option>
              <option value="Cancelled">{t("statusCancelled")}</option>
              <option value="Failed">{t("statusFailed")}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 mb-6">
          {error}
        </div>
      )}

      {/* Campaign List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t("table.campaign")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t("status")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t("table.recipients")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t("table.statistics")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t("table.created")}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t("table.actions")}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredCampaigns.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  {t("noCampaignsFound")}
                </td>
              </tr>
            ) : (
              filteredCampaigns.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link href={`/communication/email-campaigns/${campaign.id}`} className="text-blue-600 hover:underline font-medium">
                      {campaign.name}
                    </Link>
                    <div className="text-sm text-gray-500">{campaign.subject}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(campaign.status)}`}>
                      {getStatusLabelTranslated(campaign.status, t)}
                    </span>
                    {campaign.scheduledAt && campaign.status === "Scheduled" && (
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(campaign.scheduledAt).toLocaleString("de-DE")}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {campaign.totalRecipients}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {campaign.status === "Sent" || campaign.status === "Sending" ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            {campaign.sentCount}
                          </span>
                          <span className="inline-flex items-center gap-1 text-blue-600">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            {campaign.openedCount}
                          </span>
                          <span className="inline-flex items-center gap-1 text-purple-600">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                            {campaign.clickedCount}
                          </span>
                        </div>
                        {campaign.bouncedCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-red-600">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            {campaign.bouncedCount} {t("bounces")}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div>{new Date(campaign.createdAt).toLocaleDateString("de-DE")}</div>
                    <div className="text-xs">{campaign.createdByName}</div>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <Link
                      href={`/communication/email-campaigns/${campaign.id}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {t("details")}
                    </Link>
                    {campaign.status === "Draft" && (
                      <>
                        <Link
                          href={`/communication/email-campaigns/${campaign.id}/edit`}
                          className="text-gray-600 hover:text-gray-800"
                        >
                          {t("edit")}
                        </Link>
                        <button
                          onClick={() => handleDelete(campaign.id, campaign.name)}
                          className="text-red-600 hover:text-red-800"
                        >
                          {t("delete")}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
          >
            {t("previous")}
          </button>
          <span className="text-gray-600">
            {t("pagination", { current: page, total: totalPages })}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
          >
            {t("next")}
          </button>
        </div>
      )}
      </div>
    </main>
  );
}

function getStatusLabelTranslated(status: EmailCampaignStatus, t: (key: string) => string): string {
  switch (status) {
    case "Draft":
      return t("statusDraft");
    case "Scheduled":
      return t("statusScheduled");
    case "Sending":
      return t("statusSending");
    case "Sent":
      return t("statusSent");
    case "Cancelled":
      return t("statusCancelled");
    case "Failed":
      return t("statusFailed");
    default:
      return status;
  }
}
