"use client";

/**
 * REQ-026: E-Mail Kampagne Detail-Ansicht
 */

import { useAuth } from "@/lib/auth";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback } from "react";
import DOMPurify from "dompurify";
import Link from "next/link";
import {
  EmailCampaignDto,
  EmailCampaignStatistics,
  EmailRecipientDto,
  PagedResponse,
  getStatusColor,
  getRecipientStatusColor,
} from "@/lib/api/email-campaigns";

export default function EmailCampaignDetailPage() {
  const { isAuthenticated, isLoading: authLoading, isVorstand, isAdmin, accessToken } = useAuth();
  const router = useRouter();
  const params = useParams();
  const t = useTranslations("emailCampaigns");
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<EmailCampaignDto | null>(null);
  const [statistics, setStatistics] = useState<EmailCampaignStatistics | null>(null);
  const [recipients, setRecipients] = useState<EmailRecipientDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [showTestModal, setShowTestModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showResendModal, setShowResendModal] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");

  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

  const fetchCampaign = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);

    try {
      const [campaignRes, statsRes, recipientsRes] = await Promise.all([
        fetch(`${baseUrl}/api/v1/email-campaigns/${campaignId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch(`${baseUrl}/api/v1/email-campaigns/${campaignId}/statistics`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch(`${baseUrl}/api/v1/email-campaigns/${campaignId}/recipients?page=1&pageSize=100`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);

      if (!campaignRes.ok) throw new Error(t("notFound"));

      const campaignData = await campaignRes.json();
      setCampaign(campaignData);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStatistics(statsData);
      }

      if (recipientsRes.ok) {
        const recipientsData: PagedResponse<EmailRecipientDto> = await recipientsRes.json();
        setRecipients(recipientsData.items);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [accessToken, baseUrl, campaignId, t]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
    if (!authLoading && isAuthenticated && !isVorstand && !isAdmin) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isVorstand, isAdmin, router]);

  useEffect(() => {
    if (accessToken && (isVorstand || isAdmin)) {
      fetchCampaign();
    }
  }, [accessToken, isVorstand, isAdmin, fetchCampaign]);

  const handleSendTest = async () => {
    if (!testEmail) return;
    setActionLoading(true);
    try {
      const response = await fetch(`${baseUrl}/api/v1/email-campaigns/${campaignId}/test`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ testEmail }),
      });

      if (!response.ok) throw new Error(t("testEmailFailed"));

      alert(t("testEmailSent"));
      setShowTestModal(false);
      setTestEmail("");
    } catch (err) {
      alert(err instanceof Error ? err.message : t("genericError"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduledAt) return;
    setActionLoading(true);
    try {
      const response = await fetch(`${baseUrl}/api/v1/email-campaigns/${campaignId}/schedule`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ scheduledAt: new Date(scheduledAt).toISOString() }),
      });

      if (!response.ok) throw new Error(t("scheduleFailed"));

      await fetchCampaign();
      setShowScheduleModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : t("genericError"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendNow = async () => {
    if (!confirm(t("confirmSendNow"))) return;
    setActionLoading(true);
    try {
      const response = await fetch(`${baseUrl}/api/v1/email-campaigns/${campaignId}/send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) throw new Error(t("sendFailed"));

      await fetchCampaign();
    } catch (err) {
      alert(err instanceof Error ? err.message : t("genericError"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm(t("confirmCancel"))) return;
    setActionLoading(true);
    try {
      const response = await fetch(`${baseUrl}/api/v1/email-campaigns/${campaignId}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) throw new Error(t("cancelFailed"));

      await fetchCampaign();
    } catch (err) {
      alert(err instanceof Error ? err.message : t("genericError"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleResend = async (failedOnly: boolean) => {
    setActionLoading(true);
    try {
      const endpoint = failedOnly ? "resend-failed" : "resend";
      const response = await fetch(`${baseUrl}/api/v1/email-campaigns/${campaignId}/${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) throw new Error(t("resendFailed"));

      await fetchCampaign();
      setShowResendModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : t("genericError"));
    } finally {
      setActionLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
            {error || t("notFound")}
          </div>
          <Link href="/communication/email-campaigns" className="text-orange-600 hover:underline mt-4 inline-block">
            {t("backToCampaigns")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href="/communication/email-campaigns" className="text-orange-600 hover:underline flex items-center gap-1 mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t("backToCampaigns")}
          </Link>

          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
              <p className="text-gray-600">{campaign.subject}</p>
            </div>
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(campaign.status)}`}>
              {t(`status${campaign.status}`)}
            </span>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6">
            {error}
          </div>
        )}

        {/* Actions for Draft */}
        {campaign.status === "Draft" && (
          <div className="bg-white rounded-xl shadow-sm p-4 mb-6 flex flex-wrap gap-4">
            <Link
              href={`/communication/email-campaigns/${campaignId}/edit`}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              {t("edit")}
            </Link>
            <button
              onClick={() => setShowTestModal(true)}
              disabled={actionLoading}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {t("sendTestEmail")}
            </button>
            <button
              onClick={() => setShowScheduleModal(true)}
              disabled={actionLoading}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {t("schedule")}
            </button>
            <button
              onClick={handleSendNow}
              disabled={actionLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              {t("sendNow")}
            </button>
          </div>
        )}

        {/* Actions for Sent */}
        {campaign.status === "Sent" && (
          <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowResendModal(true)}
                disabled={actionLoading}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                {t("resend")}
              </button>
            </div>
          </div>
        )}

      {campaign.status === "Scheduled" && (
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl mb-6 flex justify-between items-center">
            <div>
              <span className="font-medium">{t("scheduledFor")} </span>
              {campaign.scheduledAt && new Date(campaign.scheduledAt).toLocaleString("de-DE")}
            </div>
            <button
              onClick={handleCancel}
              disabled={actionLoading}
              className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              {t("cancel")}
            </button>
          </div>
        )}

        {/* Statistics */}
        {statistics && (campaign.status === "Sent" || campaign.status === "Sending") && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">{t("statistics")}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <StatCard label={t("stats.total")} value={statistics.totalRecipients} />
              <StatCard label={t("stats.sent")} value={statistics.sent} color="blue" />
              <StatCard label={t("stats.delivered")} value={statistics.delivered} color="green" />
              <StatCard label={t("stats.opened")} value={statistics.opened} rate={statistics.openRate} color="emerald" />
              <StatCard label={t("stats.clicked")} value={statistics.clicked} rate={statistics.clickRate} color="orange" />
              <StatCard label={t("stats.bounces")} value={statistics.bounced} rate={statistics.bounceRate} color="yellow" />
              <StatCard label={t("stats.errors")} value={statistics.failed} color="red" />
            </div>
          </div>
        )}

        {/* Details */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">{t("details")}</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex flex-col">
              <dt className="text-sm text-gray-500">{t("sender")}</dt>
              <dd className="font-medium text-gray-900">{campaign.fromName} &lt;{campaign.fromEmail}&gt;</dd>
            </div>
            {campaign.replyToEmail && (
              <div className="flex flex-col">
                <dt className="text-sm text-gray-500">{t("replyTo")}</dt>
                <dd className="font-medium text-gray-900">{campaign.replyToEmail}</dd>
              </div>
            )}
            <div className="flex flex-col">
              <dt className="text-sm text-gray-500">{t("recipients")}</dt>
              <dd className="font-medium text-gray-900">{campaign.totalRecipients}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-sm text-gray-500">{t("created")}</dt>
              <dd className="font-medium text-gray-900">
                {new Date(campaign.createdAt).toLocaleString("de-DE")}
                <span className="text-gray-500 text-sm ml-2">{t("by")} {campaign.createdByName}</span>
              </dd>
            </div>
            {campaign.sentAt && (
              <div className="flex flex-col">
                <dt className="text-sm text-gray-500">{t("sentAt")}</dt>
                <dd className="font-medium text-gray-900">{new Date(campaign.sentAt).toLocaleString("de-DE")}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Email Preview Card - Full Width */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="font-medium text-gray-700">{t("emailPreview")}</span>
            </div>
            <Link
              href={`/communication/email-campaigns/${campaignId}/edit`}
              className="text-orange-600 hover:text-orange-700 font-medium text-sm"
            >
              {t("edit")}
            </Link>
          </div>

          {/* Email Client Frame */}
          <div className="border border-gray-200 m-4 rounded-lg overflow-hidden shadow-inner bg-white">
            {/* Email Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-b">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="flex-shrink-0 w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <span className="text-orange-600 font-bold text-lg">
                    {campaign.fromName?.charAt(0)?.toUpperCase() || 'I'}
                  </span>
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-lg">{campaign.fromName}</span>
                    <span className="text-gray-400">&lt;{campaign.fromEmail}&gt;</span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {t("to")} <span className="text-gray-700">{t("recipients")}</span>
                  </div>
                </div>
                <div className="text-sm text-gray-400 flex-shrink-0">
                  {campaign.sentAt
                    ? new Date(campaign.sentAt).toLocaleString("de-DE", { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : t("statusDraft")
                  }
                </div>
              </div>
            </div>

            {/* Subject Line */}
            <div className="px-6 py-3 bg-gray-50 border-b">
              <h3 className="font-semibold text-gray-900 text-lg">{campaign.subject}</h3>
            </div>

            {/* Email Body */}
            <div className="max-h-[500px] overflow-auto bg-white">
              <div
                className="p-6 prose prose-base max-w-none"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(campaign.htmlContent) }}
              />
            </div>

            {/* Email Footer Bar */}
            <div className="px-6 py-3 bg-gray-50 border-t flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {campaign.totalRecipients} {t("recipients")}
              </span>
            </div>
          </div>
        </div>

        {/* Recipients */}
        {recipients.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">{t("recipients")} ({recipients.length})</h2>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t("table.email")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t("table.name")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t("table.status")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t("table.activity")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recipients.map((recipient) => (
                  <tr key={recipient.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm">{recipient.email}</td>
                    <td className="px-6 py-4 text-sm">
                      {recipient.firstName} {recipient.lastName}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRecipientStatusColor(recipient.status)}`}>
                        {recipient.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {recipient.openedAt && `${t("openedAt")}: ${new Date(recipient.openedAt).toLocaleString("de-DE")}`}
                      {recipient.clickedAt && ` • ${t("clickedAt")}: ${new Date(recipient.clickedAt).toLocaleString("de-DE")}`}
                      {recipient.errorMessage && <span className="text-red-600">{recipient.errorMessage}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Test Email Modal */}
        {showTestModal && (
          <Modal title={t("sendTestEmail")} onClose={() => setShowTestModal(false)}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("modal.emailAddress")}</label>
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="test@example.com"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowTestModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={handleSendTest}
                  disabled={actionLoading || !testEmail}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
                >
                  {actionLoading ? t("modal.sending") : t("modal.sendTest")}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Schedule Modal */}
        {showScheduleModal && (
          <Modal title={t("modal.scheduleCampaign")} onClose={() => setShowScheduleModal(false)}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("modal.sendTime")}</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={handleSchedule}
                  disabled={actionLoading || !scheduledAt}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
                >
                  {actionLoading ? t("modal.scheduling") : t("schedule")}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Resend Modal */}
        {showResendModal && (
          <Modal title={t("modal.resendCampaign")} onClose={() => setShowResendModal(false)}>
            <div className="space-y-4">
              <p className="text-gray-600">
                {t("modal.resendDescription")}
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => handleResend(false)}
                  disabled={actionLoading}
                  className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <div className="font-medium text-gray-900">{t("modal.sendToAll")}</div>
                  <div className="text-sm text-gray-500">{t("modal.sendToAllDesc", { count: campaign.totalRecipients })}</div>
                </button>
                <button
                  onClick={() => handleResend(true)}
                  disabled={actionLoading || (statistics?.failed ?? 0) === 0}
                  className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <div className="font-medium text-gray-900">{t("modal.sendToFailedOnly")}</div>
                  <div className="text-sm text-gray-500">
                    {t("modal.sendToFailedDesc", { count: statistics?.failed ?? 0 })}
                  </div>
                </button>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setShowResendModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={actionLoading}
                >
                  {t("cancel")}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, rate, color }: { label: string; value: number; rate?: number; color?: string }) {
  const colorClasses: Record<string, string> = {
    blue: "text-blue-600",
    green: "text-green-600",
    emerald: "text-emerald-600",
    orange: "text-orange-600",
    yellow: "text-yellow-600",
    red: "text-red-600",
  };

  return (
    <div className="text-center p-3 bg-gray-50 rounded-xl">
      <div className={`text-2xl font-bold ${color ? colorClasses[color] : "text-gray-900"}`}>
        {value}
      </div>
      <div className="text-sm text-gray-600">{label}</div>
      {rate !== undefined && (
        <div className="text-xs text-gray-500">{(rate * 100).toFixed(1)}%</div>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}


