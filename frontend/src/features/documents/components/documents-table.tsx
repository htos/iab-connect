import { useTranslations } from "next-intl";
import { formatFileSize } from "@/lib/services/documents";
import { DocumentDownloadButton } from "./document-download-button";
import type { DocumentDto } from "../types/document.types";

interface DocumentsTableProps {
  documents: DocumentDto[];
  onDownloadError: () => void;
}

// Documents table (page.tsx:300-403). Responsive column hiding preserved
// verbatim: name + inline tags always; category hidden <md; size hidden <lg;
// the de-CH formatted date hidden <lg; the download action always. `formatFileSize`
// is the real shared helper (a pure formatter, not transport — boundary-legal).
export function DocumentsTable({
  documents,
  onDownloadError,
}: DocumentsTableProps) {
  const t = useTranslations();
  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
              {t("documents.documentName")}
            </th>
            <th className="hidden px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase md:table-cell">
              {t("documents.category")}
            </th>
            <th className="hidden px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase lg:table-cell">
              {t("documents.size")}
            </th>
            <th className="hidden px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase lg:table-cell">
              {t("documents.date")}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
              {t("common.actions")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {documents.map((doc) => (
            <tr key={doc.id} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <svg
                    className="h-8 w-8 shrink-0 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <div>
                    <p className="font-medium text-gray-900">{doc.name}</p>
                    {doc.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {doc.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </td>
              <td className="hidden px-6 py-4 md:table-cell">
                <span className="text-sm text-gray-600">{doc.category}</span>
              </td>
              <td className="hidden px-6 py-4 lg:table-cell">
                <span className="text-sm text-gray-600">
                  {formatFileSize(doc.fileSize)}
                </span>
              </td>
              <td className="hidden px-6 py-4 lg:table-cell">
                <span className="text-sm text-gray-600">
                  {new Date(doc.createdAt).toLocaleDateString("de-CH", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </span>
              </td>
              <td className="px-6 py-4">
                <DocumentDownloadButton doc={doc} onError={onDownloadError} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
