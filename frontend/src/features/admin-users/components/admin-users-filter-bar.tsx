import { useTranslations } from "next-intl";

interface AdminUsersFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  onSubmit: () => void;
}

// Admin users search bar: explicit-submit server-side search. Markup + brand
// classes preserved VERBATIM from the god-page (placeholder `searchPlaceholder`,
// the gray submit button). The S1 net pins the placeholder + the submit-resets-
// page-1 behaviour (the page-content owns the page reset).
export function AdminUsersFilterBar({
  search,
  onSearchChange,
  onSubmit,
}: AdminUsersFilterBarProps) {
  const t = useTranslations("users");
  const tCommon = useTranslations("common");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="mb-6"
    >
      <div className="flex gap-2">
        <input
          type="text"
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="flex-1 rounded-xl border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
        />
        <button
          type="submit"
          className="rounded-xl bg-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-300 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
        >
          {tCommon("search")}
        </button>
      </div>
    </form>
  );
}
