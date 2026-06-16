"use client";

/**
 * Audit filter panel (E27-S4). The 7 SERVER-side filter controls
 * (fromDate/toDate/category/eventType/severity/success/search). Structure is
 * preserved verbatim from the god-page so the E27-S1 net's `controlForLabel`
 * helper (label text → control inside the wrapping `<div>`) keeps resolving each
 * control, and so each change calls `onFilterChange(key, value)` which resets
 * `page:1` + refetches. The labels are NOT wired via htmlFor/id (S1 relies on
 * this — do not add `id`s).
 */

import { useTranslations } from "next-intl";
import type {
  AuditCategory,
  AuditEventType,
  AuditFilterOptions,
} from "../types/audit.types";

const FIELD_CLASS =
  "w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500";

interface AuditFilterBarProps {
  filters: AuditFilterOptions;
  categories: AuditCategory[];
  eventTypes: AuditEventType[];
  onFilterChange: (
    key: keyof AuditFilterOptions,
    value: string | boolean | undefined
  ) => void;
  onClear: () => void;
}

export function AuditFilterBar({
  filters,
  categories,
  eventTypes,
  onFilterChange,
  onClear,
}: AuditFilterBarProps) {
  const t = useTranslations("audit");

  return (
    <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Date Range */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("filters.fromDate")}
          </label>
          <input
            type="date"
            value={filters.fromDate?.split("T")[0] || ""}
            onChange={(e) =>
              onFilterChange(
                "fromDate",
                e.target.value
                  ? new Date(e.target.value).toISOString()
                  : undefined
              )
            }
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("filters.toDate")}
          </label>
          <input
            type="date"
            value={filters.toDate?.split("T")[0] || ""}
            onChange={(e) =>
              onFilterChange(
                "toDate",
                e.target.value
                  ? new Date(e.target.value).toISOString()
                  : undefined
              )
            }
            className={FIELD_CLASS}
          />
        </div>

        {/* Category */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("filters.category")}
          </label>
          <select
            value={filters.category || ""}
            onChange={(e) => onFilterChange("category", e.target.value)}
            className={FIELD_CLASS}
          >
            <option value="">{t("filters.all")}</option>
            {categories.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Event Type */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("filters.eventType")}
          </label>
          <select
            value={filters.eventType || ""}
            onChange={(e) => onFilterChange("eventType", e.target.value)}
            className={FIELD_CLASS}
          >
            <option value="">{t("filters.all")}</option>
            {eventTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Severity */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("filters.severity")}
          </label>
          <select
            value={filters.severity || ""}
            onChange={(e) => onFilterChange("severity", e.target.value)}
            className={FIELD_CLASS}
          >
            <option value="">{t("filters.all")}</option>
            <option value="Info">{t("severity.info")}</option>
            <option value="Warning">{t("severity.warning")}</option>
            <option value="Critical">{t("severity.critical")}</option>
          </select>
        </div>

        {/* Success/Failure */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("filters.status")}
          </label>
          <select
            value={filters.success === undefined ? "" : String(filters.success)}
            onChange={(e) =>
              onFilterChange(
                "success",
                e.target.value === "" ? undefined : e.target.value === "true"
              )
            }
            className={FIELD_CLASS}
          >
            <option value="">{t("filters.all")}</option>
            <option value="true">{t("status.success")}</option>
            <option value="false">{t("status.failure")}</option>
          </select>
        </div>

        {/* Search */}
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("filters.search")}
          </label>
          <input
            type="text"
            value={filters.search || ""}
            onChange={(e) => onFilterChange("search", e.target.value)}
            placeholder={t("filters.searchPlaceholder")}
            className={FIELD_CLASS}
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={onClear}
          className="rounded-xl px-4 py-2 text-gray-600 hover:text-gray-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
        >
          {t("filters.clear")}
        </button>
      </div>
    </div>
  );
}
