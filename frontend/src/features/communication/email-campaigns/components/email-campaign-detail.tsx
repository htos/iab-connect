"use client";

/**
 * Email-campaign DETAIL page content (REQ-026, E25-S3) — the RICHEST E25 surface:
 * the status state-machine action bar, the test/schedule/resend MODALS, the
 * send/cancel native `confirm()` gates (A86 — no new dialog primitive), the 7-card
 * statistics grid, the DOMPurify-sanitized preview, and the recipients table.
 * KEEPS `useParams()` inside the slice (the S1 spec mocks it) so the route entry
 * stays trivial.
 *
 * Behaviour preserved VERBATIM (pinned by the E25-S1 detail action-matrix net):
 *   - /login + / redirects; the load + auth spinner; the not-found view;
 *   - the per-status action MATRIX:
 *       Draft     → Edit link + Send-test modal + Schedule modal + Send-now(confirm)
 *       Scheduled → Cancel(confirm) banner
 *       Sent      → Resend modal (sendToAll always; sendToFailedOnly disabled when
 *                   statistics.failed === 0) + statistics grid
 *       Sending   → statistics grid only (no Draft/Scheduled/Sent panels)
 *   - each action's ENDPOINT (test/schedule/send/cancel/resend|resend-failed),
 *     confirm gate, and success(refetch)/error(`alert(<fixedFailureKey>)`) branch
 *     (A76 — the god-page alerted the FIXED key, NOT the server message, so the
 *     component's `onError` alerts the same key regardless of `mutation.error`);
 *   - the DOMPurify preview + the recipients table + the status/recipient badges.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import DOMPurify from "dompurify";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useEmailCampaign } from "../hooks/use-email-campaign";
import { useCampaignStatistics } from "../hooks/use-campaign-statistics";
import { useCampaignRecipients } from "../hooks/use-campaign-recipients";
import { useCampaignActions } from "../hooks/use-campaign-actions";
import { EmailCampaignStatusBadge } from "./email-campaign-status-badge";
import { EmailCampaignRecipientBadge } from "./email-campaign-recipient-badge";

export function EmailCampaignDetail() {
  const {
    isAuthenticated,
    isLoading: authLoading,
    isVorstand,
    isAdmin,
  } = useAuth();
  const router = useRouter();
  const params = useParams();
  const t = useTranslations("emailCampaigns");
  const campaignId = params.id as string;

  const [testEmail, setTestEmail] = useState("");
  const [showTestModal, setShowTestModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showResendModal, setShowResendModal] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");

  const authorized = isVorstand || isAdmin;
  const enabled = isAuthenticated && authorized;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
    if (!authLoading && isAuthenticated && !isVorstand && !isAdmin) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isVorstand, isAdmin, router]);

  const { data: campaign, isLoading: queryLoading } = useEmailCampaign(
    campaignId,
    enabled
  );
  const { data: statistics } = useCampaignStatistics(campaignId, enabled);
  const { data: recipients = [] } = useCampaignRecipients(campaignId, enabled);
  const actions = useCampaignActions(campaignId);

  const actionLoading =
    actions.test.isPending ||
    actions.schedule.isPending ||
    actions.send.isPending ||
    actions.cancel.isPending ||
    actions.resend.isPending;

  const handleSendTest = () => {
    if (!testEmail) return;
    actions.test.mutate(testEmail, {
      onSuccess: () => {
        alert(t("testEmailSent"));
        setShowTestModal(false);
        setTestEmail("");
      },
      onError: () => alert(t("testEmailFailed")),
    });
  };

  const handleSchedule = () => {
    if (!scheduledAt) return;
    actions.schedule.mutate(new Date(scheduledAt).toISOString(), {
      onSuccess: () => setShowScheduleModal(false),
      onError: () => alert(t("scheduleFailed")),
    });
  };

  const handleSendNow = () => {
    if (!confirm(t("confirmSendNow"))) return;
    actions.send.mutate(undefined, {
      onError: () => alert(t("sendFailed")),
    });
  };

  const handleCancel = () => {
    if (!confirm(t("confirmCancel"))) return;
    actions.cancel.mutate(undefined, {
      onError: () => alert(t("cancelFailed")),
    });
  };

  const handleResend = (failedOnly: boolean) => {
    actions.resend.mutate(failedOnly, {
      onSuccess: () => setShowResendModal(false),
      onError: () => alert(t("resendFailed")),
    });
  };

  if (authLoading || (authorized && queryLoading)) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gray-50 p-4 md:p-8">
        <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {t("notFound")}
          </div>
          <Link
            href="/communication/email-campaigns"
            className="mt-4 inline-block text-orange-600 hover:underline"
          >
            {t("backToCampaigns")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/communication/email-campaigns"
            className="mb-2 flex items-center gap-1 text-orange-600 hover:underline"
          >
            <svg
              className="h-4 w-4"
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
            {t("backToCampaigns")}
          </Link>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {campaign.name}
              </h1>
              <p className="text-gray-600">{campaign.subject}</p>
            </div>
            <EmailCampaignStatusBadge status={campaign.status} />
          </div>
        </div>

        {/* Actions for Draft */}
        {campaign.status === "Draft" && (
          <div className="mb-6 flex flex-wrap gap-4 rounded-xl bg-white p-4 shadow-sm">
            <Link
              href={`/communication/email-campaigns/${campaignId}/edit`}
              className="rounded-lg bg-orange-600 px-4 py-2 text-white transition-colors hover:bg-orange-700"
            >
              {t("edit")}
            </Link>
            <button
              onClick={() => setShowTestModal(true)}
              disabled={actionLoading}
              className="rounded-lg border border-gray-300 px-4 py-2 transition-colors hover:bg-gray-50"
            >
              {t("sendTestEmail")}
            </button>
            <button
              onClick={() => setShowScheduleModal(true)}
              disabled={actionLoading}
              className="rounded-lg border border-gray-300 px-4 py-2 transition-colors hover:bg-gray-50"
            >
              {t("schedule")}
            </button>
            <button
              onClick={handleSendNow}
              disabled={actionLoading}
              className="rounded-lg bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700"
            >
              {t("sendNow")}
            </button>
          </div>
        )}

        {/* Actions for Sent */}
        {campaign.status === "Sent" && (
          <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowResendModal(true)}
                disabled={actionLoading}
                className="rounded-lg bg-orange-600 px-4 py-2 text-white transition-colors hover:bg-orange-700"
              >
                {t("resend")}
              </button>
            </div>
          </div>
        )}

        {campaign.status === "Scheduled" && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-yellow-200 bg-yellow-50 p-4">
            <div>
              <span className="font-medium">{t("scheduledFor")} </span>
              {campaign.scheduledAt &&
                new Date(campaign.scheduledAt).toLocaleString("de-DE")}
            </div>
            <button
              onClick={handleCancel}
              disabled={actionLoading}
              className="rounded-lg border border-red-300 px-4 py-2 text-red-600 transition-colors hover:bg-red-50"
            >
              {t("cancel")}
            </button>
          </div>
        )}

        {/* Statistics */}
        {statistics &&
          (campaign.status === "Sent" || campaign.status === "Sending") && (
            <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">{t("statistics")}</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
                <StatCard
                  label={t("stats.total")}
                  value={statistics.totalRecipients}
                />
                <StatCard
                  label={t("stats.sent")}
                  value={statistics.sent}
                  color="blue"
                />
                <StatCard
                  label={t("stats.delivered")}
                  value={statistics.delivered}
                  color="green"
                />
                <StatCard
                  label={t("stats.opened")}
                  value={statistics.opened}
                  rate={statistics.openRate}
                  color="emerald"
                />
                <StatCard
                  label={t("stats.clicked")}
                  value={statistics.clicked}
                  rate={statistics.clickRate}
                  color="orange"
                />
                <StatCard
                  label={t("stats.bounces")}
                  value={statistics.bounced}
                  rate={statistics.bounceRate}
                  color="yellow"
                />
                <StatCard
                  label={t("stats.errors")}
                  value={statistics.failed}
                  color="red"
                />
              </div>
            </div>
          )}

        {/* Details */}
        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">{t("details")}</h2>
          <dl className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col">
              <dt className="text-sm text-gray-500">{t("sender")}</dt>
              <dd className="font-medium text-gray-900">
                {campaign.fromName} &lt;{campaign.fromEmail}&gt;
              </dd>
            </div>
            {campaign.replyToEmail && (
              <div className="flex flex-col">
                <dt className="text-sm text-gray-500">{t("replyTo")}</dt>
                <dd className="font-medium text-gray-900">
                  {campaign.replyToEmail}
                </dd>
              </div>
            )}
            <div className="flex flex-col">
              <dt className="text-sm text-gray-500">{t("recipients")}</dt>
              <dd className="font-medium text-gray-900">
                {campaign.totalRecipients}
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-sm text-gray-500">{t("created")}</dt>
              <dd className="font-medium text-gray-900">
                {new Date(campaign.createdAt).toLocaleString("de-DE")}
                <span className="ml-2 text-sm text-gray-500">
                  {t("by")} {campaign.createdByName}
                </span>
              </dd>
            </div>
            {campaign.sentAt && (
              <div className="flex flex-col">
                <dt className="text-sm text-gray-500">{t("sentAt")}</dt>
                <dd className="font-medium text-gray-900">
                  {new Date(campaign.sentAt).toLocaleString("de-DE")}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Email Preview Card - Full Width */}
        <div className="mb-6 overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="flex items-center justify-between border-b bg-gray-50 p-4">
            <div className="flex items-center gap-2 text-gray-500">
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
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <span className="font-medium text-gray-700">
                {t("emailPreview")}
              </span>
            </div>
            <Link
              href={`/communication/email-campaigns/${campaignId}/edit`}
              className="text-sm font-medium text-orange-600 hover:text-orange-700"
            >
              {t("edit")}
            </Link>
          </div>

          {/* Email Client Frame */}
          <div className="m-4 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-inner">
            {/* Email Header */}
            <div className="border-b bg-linear-to-r from-gray-50 to-white px-6 py-4">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100">
                  <span className="text-lg font-bold text-orange-600">
                    {campaign.fromName?.charAt(0)?.toUpperCase() || "I"}
                  </span>
                </div>
                <div className="min-w-0 grow">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-semibold text-gray-900">
                      {campaign.fromName}
                    </span>
                    <span className="text-gray-400">
                      &lt;{campaign.fromEmail}&gt;
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-gray-500">
                    {t("to")}{" "}
                    <span className="text-gray-700">{t("recipients")}</span>
                  </div>
                </div>
                <div className="shrink-0 text-sm text-gray-400">
                  {campaign.sentAt
                    ? new Date(campaign.sentAt).toLocaleString("de-DE", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : t("statusDraft")}
                </div>
              </div>
            </div>

            {/* Subject Line */}
            <div className="border-b bg-gray-50 px-6 py-3">
              <h3 className="text-lg font-semibold text-gray-900">
                {campaign.subject}
              </h3>
            </div>

            {/* Email Body */}
            <div className="max-h-125 overflow-auto bg-white">
              <div
                className="prose prose-base max-w-none p-6"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(campaign.htmlContent),
                }}
              />
            </div>

            {/* Email Footer Bar */}
            <div className="flex items-center gap-4 border-t bg-gray-50 px-6 py-3 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                {campaign.totalRecipients} {t("recipients")}
              </span>
            </div>
          </div>
        </div>

        {/* Recipients */}
        {recipients.length > 0 && (
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <div className="border-b p-4">
              <h2 className="text-lg font-semibold">
                {t("recipients")} ({recipients.length})
              </h2>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t("table.email")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t("table.name")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t("table.status")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t("table.activity")}
                  </th>
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
                      <EmailCampaignRecipientBadge status={recipient.status} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {recipient.openedAt &&
                        `${t("openedAt")}: ${new Date(
                          recipient.openedAt
                        ).toLocaleString("de-DE")}`}
                      {recipient.clickedAt &&
                        ` • ${t("clickedAt")}: ${new Date(
                          recipient.clickedAt
                        ).toLocaleString("de-DE")}`}
                      {recipient.errorMessage && (
                        <span className="text-red-600">
                          {recipient.errorMessage}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Test Email Modal */}
        {showTestModal && (
          <Modal
            title={t("sendTestEmail")}
            onClose={() => setShowTestModal(false)}
          >
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("modal.emailAddress")}
                </label>
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-orange-500 focus:ring-orange-500"
                  placeholder="test@example.com"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowTestModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 transition-colors hover:bg-gray-50"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={handleSendTest}
                  disabled={actionLoading || !testEmail}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
                >
                  {actionLoading ? t("modal.sending") : t("modal.sendTest")}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Schedule Modal */}
        {showScheduleModal && (
          <Modal
            title={t("modal.scheduleCampaign")}
            onClose={() => setShowScheduleModal(false)}
          >
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("modal.sendTime")}
                </label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-orange-500 focus:ring-orange-500"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 transition-colors hover:bg-gray-50"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={handleSchedule}
                  disabled={actionLoading || !scheduledAt}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
                >
                  {actionLoading ? t("modal.scheduling") : t("schedule")}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Resend Modal */}
        {showResendModal && (
          <Modal
            title={t("modal.resendCampaign")}
            onClose={() => setShowResendModal(false)}
          >
            <div className="space-y-4">
              <p className="text-gray-600">{t("modal.resendDescription")}</p>
              <div className="space-y-3">
                <button
                  onClick={() => handleResend(false)}
                  disabled={actionLoading}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-left transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  <div className="font-medium text-gray-900">
                    {t("modal.sendToAll")}
                  </div>
                  <div className="text-sm text-gray-500">
                    {t("modal.sendToAllDesc", {
                      count: campaign.totalRecipients,
                    })}
                  </div>
                </button>
                <button
                  onClick={() => handleResend(true)}
                  disabled={actionLoading || (statistics?.failed ?? 0) === 0}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-left transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  <div className="font-medium text-gray-900">
                    {t("modal.sendToFailedOnly")}
                  </div>
                  <div className="text-sm text-gray-500">
                    {t("modal.sendToFailedDesc", {
                      count: statistics?.failed ?? 0,
                    })}
                  </div>
                </button>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setShowResendModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 transition-colors hover:bg-gray-50"
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

function StatCard({
  label,
  value,
  rate,
  color,
}: {
  label: string;
  value: number;
  rate?: number;
  color?: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: "text-blue-600",
    green: "text-green-600",
    emerald: "text-emerald-600",
    orange: "text-orange-600",
    yellow: "text-yellow-600",
    red: "text-red-600",
  };

  return (
    <div className="rounded-xl bg-gray-50 p-3 text-center">
      <div
        className={`text-2xl font-bold ${
          color ? colorClasses[color] : "text-gray-900"
        }`}
      >
        {value}
      </div>
      <div className="text-sm text-gray-600">{label}</div>
      {rate !== undefined && (
        <div className="text-xs text-gray-500">{(rate * 100).toFixed(1)}%</div>
      )}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 transition-colors hover:text-gray-600"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
