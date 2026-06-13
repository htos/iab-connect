import { useTranslations } from "next-intl";

interface EventsFilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  categoryFilter: string;
  onCategoryChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  // Status filter + manager-gated affordances only show for managers.
  canManageEvents: boolean;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
}

// Filter bar: per-keystroke server-side search (debounced upstream), category
// filter, manager-only status filter, and the grid/list view toggle. Markup +
// brand classes + i18n keys preserved verbatim from the god-page.
export function EventsFilterBar({
  searchTerm,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  statusFilter,
  onStatusChange,
  canManageEvents,
  viewMode,
  onViewModeChange,
}: EventsFilterBarProps) {
  const t = useTranslations("events");

  return (
    <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Search */}
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
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-10 text-sm transition-colors outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
          />
        </div>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => onCategoryChange(e.target.value)}
          aria-label={t("allCategories")}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-colors outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
        >
          <option value="">{t("allCategories")}</option>
          <option value="General">{t("category.general")}</option>
          <option value="Cultural">{t("category.cultural")}</option>
          <option value="Religious">{t("category.religious")}</option>
          <option value="Social">{t("category.social")}</option>
          <option value="Sports">{t("category.sports")}</option>
          <option value="Educational">{t("category.educational")}</option>
          <option value="Charity">{t("category.charity")}</option>
          <option value="Meeting">{t("category.meeting")}</option>
          <option value="Workshop">{t("category.workshop")}</option>
          <option value="Festival">{t("category.festival")}</option>
          <option value="Other">{t("category.other")}</option>
        </select>

        {/* Status Filter (only for managers) */}
        {canManageEvents && (
          <select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            aria-label={t("allStatuses")}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-colors outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
          >
            <option value="">{t("allStatuses")}</option>
            <option value="Draft">{t("status.draft")}</option>
            <option value="Published">{t("status.published")}</option>
            <option value="Cancelled">{t("status.cancelled")}</option>
            <option value="Completed">{t("status.completed")}</option>
          </select>
        )}

        {/* View Toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-gray-300 p-1">
          <button
            onClick={() => onViewModeChange("grid")}
            aria-label={t("gridView")}
            aria-pressed={viewMode === "grid"}
            className={`rounded p-1.5 ${viewMode === "grid" ? "bg-orange-100 text-orange-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
              />
            </svg>
          </button>
          <button
            onClick={() => onViewModeChange("list")}
            aria-label={t("listView")}
            aria-pressed={viewMode === "list"}
            className={`rounded p-1.5 ${viewMode === "list" ? "bg-orange-100 text-orange-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
