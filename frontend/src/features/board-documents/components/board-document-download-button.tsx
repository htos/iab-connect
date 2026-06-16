"use client";

import { useTranslations } from "next-intl";

interface BoardDocumentDownloadButtonProps {
  onDownload: () => void;
}

/**
 * Header "Download current" button for the document detail (E29-S3). The
 * authenticated blob fetch lives in `use-board-document-download` (a side-effect
 * hook, mirrors E29-S2 DEC-2); this is just the primary-styled affordance that
 * triggers it. Markup/label preserved from the god-page (`[id]/page.tsx:259-264`).
 */
export function BoardDocumentDownloadButton({
  onDownload,
}: BoardDocumentDownloadButtonProps) {
  const t = useTranslations();
  return (
    <button
      onClick={onDownload}
      className="rounded-lg bg-orange-600 px-4 py-2 text-sm text-white transition-colors hover:bg-orange-700"
    >
      {t("documents.download")}
    </button>
  );
}
