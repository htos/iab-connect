"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { EmailCampaignStatusBadge } from "./email-campaign-status-badge";
import type { EmailCampaignDto } from "../types/email-campaign.types";

/**
 * The email-campaigns list table (E25-S3). Markup preserved verbatim from the
 * god-page: the campaign name link + subject, the status badge (+ scheduled-at
 * hint), recipients count, the Sent/Sending statistics column, created date +
 * author, and the per-row actions where Edit/Delete appear ONLY for a Draft
 * campaign. Delete is a `<button>` (S1 net asserts it via role) that delegates to
 * the page content's confirm→delete→refetch flow.
 */
export function EmailCampaignsTable({
  campaigns,
  onDelete,
}: {
  campaigns: EmailCampaignDto[];
  onDelete: (id: string, name: string) => void;
}) {
  const t = useTranslations("emailCampaigns");

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
              {t("table.campaign")}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
              {t("status")}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
              {t("table.recipients")}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
              {t("table.statistics")}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
              {t("table.created")}
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
              {t("table.actions")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {campaigns.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                {t("noCampaignsFound")}
              </td>
            </tr>
          ) : (
            campaigns.map((campaign) => (
              <tr key={campaign.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <Link
                    href={`/communication/email-campaigns/${campaign.id}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {campaign.name}
                  </Link>
                  <div className="text-sm text-gray-500">
                    {campaign.subject}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <EmailCampaignStatusBadge status={campaign.status} />
                  {campaign.scheduledAt && campaign.status === "Scheduled" && (
                    <div className="mt-1 text-xs text-gray-500">
                      {new Date(campaign.scheduledAt).toLocaleString("de-DE")}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {campaign.totalRecipients}
                </td>
                <td className="px-6 py-4 text-sm">
                  {campaign.status === "Sent" ||
                  campaign.status === "Sending" ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-green-600">
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
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          {campaign.sentCount}
                        </span>
                        <span className="inline-flex items-center gap-1 text-blue-600">
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
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                          {campaign.openedCount}
                        </span>
                        <span className="inline-flex items-center gap-1 text-purple-600">
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
                              d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                            />
                          </svg>
                          {campaign.clickedCount}
                        </span>
                      </div>
                      {campaign.bouncedCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-red-600">
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
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                          </svg>
                          {campaign.bouncedCount} {t("bounces")}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  <div>
                    {new Date(campaign.createdAt).toLocaleDateString("de-DE")}
                  </div>
                  <div className="text-xs">{campaign.createdByName}</div>
                </td>
                <td className="space-x-2 px-6 py-4 text-right">
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
                        onClick={() => onDelete(campaign.id, campaign.name)}
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
  );
}
