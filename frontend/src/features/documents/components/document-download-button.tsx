import { useTranslations } from "next-intl";
import { useDocumentDownload } from "../hooks/use-document-download";
import type { DocumentDto } from "../types/document.types";

interface DocumentDownloadButtonProps {
  doc: DocumentDto;
  /**
   * Surfaces a failed download to the parent (A76) — the parent owns the page
   * error banner, so on failure it sets `documents.downloadError`. Called with
   * `null` is never done (success is silent), matching the god-page where a
   * successful download left the banner untouched.
   */
  onError: () => void;
}

// Download action cell (page.tsx:377-396). The authenticated blob download
// lives in `use-document-download` (DEC-2 = A side-effect hook); this button
// invokes it and surfaces a failure to the parent banner.
export function DocumentDownloadButton({
  doc,
  onError,
}: DocumentDownloadButtonProps) {
  const t = useTranslations();
  const { download } = useDocumentDownload();

  const handleClick = async () => {
    const error = await download(doc);
    if (error) onError();
  };

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1 text-sm font-medium text-orange-600 hover:text-orange-800"
    >
      <svg
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        />
      </svg>
      {t("documents.download")}
    </button>
  );
}
