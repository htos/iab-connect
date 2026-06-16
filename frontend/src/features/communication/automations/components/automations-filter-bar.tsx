import { useTranslations } from "next-intl";
import type { AutomationStatus } from "../types/automation.types";

interface AutomationsFilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: AutomationStatus | "";
  onStatusChange: (value: AutomationStatus | "") => void;
}

// Filter bar: client-side search (left) + server-side status filter (right).
// Markup preserved verbatim from the god-page (search placeholder + the single
// status <select>, which the S1 list spec selects as the only combobox).
export function AutomationsFilterBar({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusChange,
}: AutomationsFilterBarProps) {
  const t = useTranslations("automations");
  return (
    <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-4">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder={t("search")}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-4 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("status")}
          </label>
          <select
            value={statusFilter}
            onChange={(e) =>
              onStatusChange(e.target.value as AutomationStatus | "")
            }
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
          >
            <option value="">{t("allStatuses")}</option>
            <option value="Draft">{t("statusDraft")}</option>
            <option value="Active">{t("statusActive")}</option>
            <option value="Paused">{t("statusPaused")}</option>
            <option value="Disabled">{t("statusDisabled")}</option>
          </select>
        </div>
      </div>
    </div>
  );
}
