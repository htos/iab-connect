"use client";

/**
 * REQ-026: E-Mail Kampagnen Liste
 * Accessible to Vorstand and Admin only
 */

import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  EmailCampaignDto,
  PagedResponse,
  EmailCampaignStatus,
  getStatusColor,
} from "@/lib/api/email-campaigns";

export default function EmailCampaignsPage() {
  const { isAuthenticated, isLoading: authLoading, isVorstand, isAdmin, accessToken } = useAuth();
  const router = useRouter();

  const [campaigns, setCampaigns] = useState<EmailCampaignDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<EmailCampaignStatus | "">("");

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
        throw new Error(`Fehler beim Laden der Kampagnen: ${response.statusText}`);
      }

      const data: PagedResponse<EmailCampaignDto> = await response.json();
      setCampaigns(data.items);
      setTotalPages(data.totalPages);
      setTotalCount(data.totalCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

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

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Kampagne "${name}" wirklich löschen?`)) return;

    try {
      const response = await fetch(`${baseUrl}/api/v1/email-campaigns/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Fehler beim Löschen");
      }

      fetchCampaigns(page, statusFilter);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Fehler beim Löschen");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Laden...</p>
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
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">E-Mail Kampagnen</h1>
            <p className="text-gray-600 mt-1">
              {totalCount} Kampagne{totalCount !== 1 ? "n" : ""} insgesamt
            </p>
          </div>
          <Link
            href="/email-campaigns/new"
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 transition-colors"
          >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neue Kampagne
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as EmailCampaignStatus | "");
                setPage(1);
              }}
              className="border rounded-lg px-3 py-2 text-gray-900"
            >
              <option value="">Alle Status</option>
              <option value="Draft">Entwurf</option>
              <option value="Scheduled">Geplant</option>
              <option value="Sending">Wird gesendet</option>
              <option value="Sent">Gesendet</option>
              <option value="Cancelled">Abgebrochen</option>
              <option value="Failed">Fehlgeschlagen</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Campaign List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Kampagne
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Empfänger
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Statistik
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Erstellt
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  Keine Kampagnen gefunden
                </td>
              </tr>
            ) : (
              campaigns.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link href={`/email-campaigns/${campaign.id}`} className="text-blue-600 hover:underline font-medium">
                      {campaign.name}
                    </Link>
                    <div className="text-sm text-gray-500">{campaign.subject}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(campaign.status)}`}>
                      {getStatusLabel(campaign.status)}
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
                          <span className="text-green-600">✓ {campaign.sentCount}</span>
                          <span className="text-blue-600">👁 {campaign.openedCount}</span>
                          <span className="text-purple-600">🖱 {campaign.clickedCount}</span>
                        </div>
                        {campaign.bouncedCount > 0 && (
                          <span className="text-red-600">⚠ {campaign.bouncedCount} Bounces</span>
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
                      href={`/email-campaigns/${campaign.id}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Details
                    </Link>
                    {campaign.status === "Draft" && (
                      <>
                        <Link
                          href={`/email-campaigns/${campaign.id}/edit`}
                          className="text-gray-600 hover:text-gray-800"
                        >
                          Bearbeiten
                        </Link>
                        <button
                          onClick={() => handleDelete(campaign.id, campaign.name)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Löschen
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
            className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Zurück
          </button>
          <span className="text-gray-600">
            Seite {page} von {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Weiter
          </button>
        </div>
      )}
      </div>
    </main>
  );
}

function getStatusLabel(status: EmailCampaignStatus): string {
  switch (status) {
    case "Draft":
      return "Entwurf";
    case "Scheduled":
      return "Geplant";
    case "Sending":
      return "Wird gesendet";
    case "Sent":
      return "Gesendet";
    case "Cancelled":
      return "Abgebrochen";
    case "Failed":
      return "Fehlgeschlagen";
    default:
      return status;
  }
}
