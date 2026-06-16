import { useTranslations } from "next-intl";

interface DocumentsFilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedTag: string;
  onTagChange: (value: string) => void;
  allTags: string[];
}

// Search input (server-side `search`) + single-tag select (server-side `tags`
// STRING filter). Markup preserved verbatim from the god-page (page.tsx:188-219);
// both controls reset page→1 in the parent. The tag filter stays single-select
// (HEAD invariant — not multi-select).
export function DocumentsFilterBar({
  searchTerm,
  onSearchChange,
  selectedTag,
  onTagChange,
  allTags,
}: DocumentsFilterBarProps) {
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
          value={selectedTag}
          onChange={(e) => onTagChange(e.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:outline-none"
        >
          <option value="">{t("documents.allTags")}</option>
          {allTags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
