"use client";

import { useTranslations } from "next-intl";
import {
  DocumentCategory,
  DocumentStatus,
} from "../types/board-document.types";

interface BoardDocumentsFilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  categoryFilter: string;
  onCategoryChange: (value: string) => void;
}

/**
 * Search + status + category filter bar for the board documents list (E29-S3).
 * Markup/classes preserved verbatim from the god-page (`page.tsx:429-475`); each
 * change resets `page → 1` in the parent (the parent owns that). The status +
 * category option lists map onto the `DocumentStatus` / `DocumentCategory` enums
 * (AC-7, no behaviour change — same string values).
 */
export function BoardDocumentsFilterBar({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusChange,
  categoryFilter,
  onCategoryChange,
}: BoardDocumentsFilterBarProps) {
  const t = useTranslations();
  return (
    <div className="mb-6 rounded-lg bg-white p-4 shadow">
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex-1">
          <input
            type="text"
            placeholder={t("documents.searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-2"
        >
          <option value="">{t("documents.allStatuses")}</option>
          {Object.values(DocumentStatus).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-2"
        >
          <option value="">{t("documents.allCategories")}</option>
          {Object.values(DocumentCategory).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
