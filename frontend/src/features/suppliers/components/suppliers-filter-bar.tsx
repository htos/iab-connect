import { useTranslations } from "next-intl";

interface SuppliersFilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
}

// Filter bar: client-side search (left) + server-side status filter (right).
// Markup preserved from the original page (existing brand classes are moved, not
// newly introduced — per AC-5 "no NEW hard-coded brand colours").
export function SuppliersFilterBar({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusChange,
}: SuppliersFilterBarProps) {
  const t = useTranslations();
  return (
    <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row">
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
            placeholder={t("suppliers.searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-10 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
        >
          <option value="">{t("suppliers.allStatuses")}</option>
          <option value="Prospect">{t("suppliers.status.Prospect")}</option>
          <option value="Active">{t("suppliers.status.Active")}</option>
          <option value="Paused">{t("suppliers.status.Paused")}</option>
          <option value="Ended">{t("suppliers.status.Ended")}</option>
        </select>
      </div>
    </div>
  );
}
