"use client";

import { useTranslations } from "next-intl";

/**
 * Client-side search box for the email-templates list (E25-S4). Purely local — no
 * refetch (the god-page filtered `templates` in-memory by name/description). Markup
 * preserved verbatim from the god-page so the S1 net (the `searchPlaceholder`
 * input) stays green.
 */
export function EmailTemplatesSearchBar({
  searchTerm,
  onSearchChange,
}: {
  searchTerm: string;
  onSearchChange: (value: string) => void;
}) {
  const t = useTranslations("emailTemplates");

  return (
    <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
      <div className="relative">
        <svg
          className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
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
          placeholder={t("searchPlaceholder")}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-10 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
        />
      </div>
    </div>
  );
}
