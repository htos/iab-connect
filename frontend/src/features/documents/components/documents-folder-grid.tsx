import { useTranslations } from "next-intl";
import type { DocumentFolderDto } from "../types/document.types";

interface DocumentsFolderGridProps {
  folders: DocumentFolderDto[];
  showUpButton: boolean;
  onNavigateUp: () => void;
  onNavigateToFolder: (folder: DocumentFolderDto) => void;
}

// Folder grid (page.tsx:227-275). The whole block only renders when there are
// folders; the up-button ("..") renders only when `showUpButton`
// (currentPath.length > 0). Markup preserved verbatim.
export function DocumentsFolderGrid({
  folders,
  showUpButton,
  onNavigateUp,
  onNavigateToFolder,
}: DocumentsFolderGridProps) {
  const t = useTranslations();
  if (folders.length === 0) return null;
  return (
    <div className="mb-6">
      <h2 className="mb-3 text-lg font-semibold text-gray-900">
        {t("documents.folders")}
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        {showUpButton && (
          <button
            onClick={onNavigateUp}
            className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50"
          >
            <svg
              className="h-10 w-10 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
              />
            </svg>
            <span className="text-sm text-gray-600">..</span>
          </button>
        )}
        {folders.map((folder) => (
          <button
            key={folder.id}
            onClick={() => onNavigateToFolder(folder)}
            className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 p-4 transition-colors hover:border-orange-200 hover:bg-orange-50"
          >
            <svg
              className="h-10 w-10 text-orange-500"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
            </svg>
            <span className="w-full truncate text-center text-sm font-medium text-gray-700">
              {folder.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
