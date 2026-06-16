import { useTranslations } from "next-intl";
import type { DocumentFolderDto } from "../types/document.types";

interface DocumentsBreadcrumbProps {
  currentPath: DocumentFolderDto[];
  onNavigateToRoot: () => void;
  onNavigateToSegment: (index: number) => void;
}

// Folder breadcrumb (page.tsx:158-186). The root button jumps to root; each
// non-last segment is a clickable button (navigates to that segment); the last
// segment is plain text (the current folder). State lives in the parent.
export function DocumentsBreadcrumb({
  currentPath,
  onNavigateToRoot,
  onNavigateToSegment,
}: DocumentsBreadcrumbProps) {
  const t = useTranslations();
  return (
    <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
      <button
        onClick={onNavigateToRoot}
        className="text-orange-600 hover:underline"
      >
        {t("documents.root")}
      </button>
      {currentPath.map((folder, index) => (
        <span key={folder.id} className="flex items-center gap-2">
          <span>/</span>
          {index === currentPath.length - 1 ? (
            <span className="font-medium text-gray-900">{folder.name}</span>
          ) : (
            <button
              onClick={() => onNavigateToSegment(index)}
              className="text-orange-600 hover:underline"
            >
              {folder.name}
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
