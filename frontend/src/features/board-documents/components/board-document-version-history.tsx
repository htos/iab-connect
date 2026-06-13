"use client";

import { useTranslations } from "next-intl";
import { formatFileSize } from "@/types/documents";
import type { DocumentVersionDto } from "../types/board-document.types";

interface BoardDocumentVersionHistoryProps {
  versions: DocumentVersionDto[];
  onDownload: (versionNumber: number) => void;
  onRestore: (versionNumber: number) => void;
}

/**
 * Version history list for the document detail (E29-S3). Markup preserved from
 * the god-page (`[id]/page.tsx:434-490`): the first row (index 0 = latest) is
 * highlighted + carries the `documents.latest` badge; each row shows the comment
 * (or `documents.noComment`), the de-CH formatted upload date + size, a Download
 * action, and — on NON-latest rows only — a Restore action (the parent opens the
 * restore-confirm). Empty → `documents.noVersions`. Restore keeps its existing
 * (non-destructive blue) styling — A86 does NOT recolour it.
 */
export function BoardDocumentVersionHistory({
  versions,
  onDownload,
  onRestore,
}: BoardDocumentVersionHistoryProps) {
  const t = useTranslations();
  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">
        {t("documents.versionHistory")}
      </h2>
      {versions.length === 0 ? (
        <p className="text-sm text-gray-400">{t("documents.noVersions")}</p>
      ) : (
        <div className="space-y-3">
          {versions.map((version, index) => (
            <div
              key={version.id}
              className={`flex items-center justify-between rounded-lg p-3 ${index === 0 ? "border border-orange-200 bg-orange-50" : "bg-gray-50"}`}
            >
              <div>
                <p className="font-medium text-gray-900">
                  v{version.versionNumber}{" "}
                  {index === 0 && (
                    <span className="ml-1 text-xs text-orange-600">
                      ({t("documents.latest")})
                    </span>
                  )}
                </p>
                <p className="text-sm text-gray-600">
                  {version.comment || t("documents.noComment")}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(version.uploadedAt).toLocaleDateString("de-CH", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}{" "}
                  · {formatFileSize(version.fileSize)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onDownload(version.versionNumber)}
                  className="text-sm text-orange-600 hover:text-orange-800"
                >
                  {t("documents.download")}
                </button>
                {index !== 0 && (
                  <button
                    onClick={() => onRestore(version.versionNumber)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    {t("documents.restore")}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
