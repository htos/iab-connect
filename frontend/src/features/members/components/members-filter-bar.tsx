import { useTranslations } from "next-intl";
import { MembershipStatus, MembershipType } from "../types/member.types";

interface MembersFilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  statusFilter: MembershipStatus | "";
  onStatusChange: (value: MembershipStatus | "") => void;
  typeFilter: MembershipType | "";
  onTypeChange: (value: MembershipType | "") => void;
}

// Filter bar: server-side search (submit), status filter, type filter. Markup +
// brand classes preserved verbatim from the god-page (no NEW hard-coded colours).
export function MembersFilterBar({
  searchTerm,
  onSearchChange,
  onSearchSubmit,
  statusFilter,
  onStatusChange,
  typeFilter,
  onTypeChange,
}: MembersFilterBarProps) {
  const t = useTranslations();
  return (
    <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSearchSubmit();
        }}
        className="flex flex-col gap-4 md:flex-row"
      >
        <div className="flex-1">
          <input
            type="text"
            placeholder={t("members.searchPlaceholder")}
            aria-label={t("members.searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) =>
            onStatusChange(e.target.value as MembershipStatus | "")
          }
          aria-label={t("members.allStatuses")}
          className="rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
        >
          <option value="">{t("members.allStatuses")}</option>
          <option value={MembershipStatus.Active}>{t("status.active")}</option>
          <option value={MembershipStatus.Pending}>
            {t("status.pending")}
          </option>
          <option value={MembershipStatus.Inactive}>
            {t("status.inactive")}
          </option>
          <option value={MembershipStatus.Suspended}>
            {t("status.suspended")}
          </option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => onTypeChange(e.target.value as MembershipType | "")}
          aria-label={t("members.allTypes")}
          className="rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
        >
          <option value="">{t("members.allTypes")}</option>
          <option value={MembershipType.Regular}>
            {t("membershipType.regular")}
          </option>
          <option value={MembershipType.Student}>
            {t("membershipType.student")}
          </option>
          <option value={MembershipType.Family}>
            {t("membershipType.family")}
          </option>
          <option value={MembershipType.Honorary}>
            {t("membershipType.honorary")}
          </option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-gray-900 px-6 py-2 text-white transition-colors hover:bg-gray-800"
        >
          {t("common.search")}
        </button>
      </form>
    </div>
  );
}
