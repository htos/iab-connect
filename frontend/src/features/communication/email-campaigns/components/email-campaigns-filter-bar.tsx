"use client";

import { useTranslations } from "next-intl";
import type { EmailCampaignStatus } from "../types/email-campaign.types";

/**
 * Filter bar for the email-campaigns list (E25-S3). Carries the client-side search
 * box (purely local — no refetch) and the server-side status `<select>` (changing
 * it resets page→1 and refetches via the list key). Markup preserved verbatim from
 * the god-page so the S1 net (search placeholder + the combobox) stays green.
 */
export function EmailCampaignsFilterBar({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusChange,
}: {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: EmailCampaignStatus | "";
  onStatusChange: (value: EmailCampaignStatus | "") => void;
}) {
  const t = useTranslations("emailCampaigns");

  return (
    <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-4">
        <div className="relative flex-1">
          <svg
            className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder={t("searchCampaigns")}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-10 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("status")}
          </label>
          <select
            value={statusFilter}
            onChange={(e) =>
              onStatusChange(e.target.value as EmailCampaignStatus | "")
            }
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
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
  );
}
