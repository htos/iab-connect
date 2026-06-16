"use client";

import { useTranslations } from "next-intl";
import { formatFileSize, getStatusColor } from "@/types/documents";
import { DocumentStatus } from "../types/board-document.types";
import type { DocumentDto } from "../types/board-document.types";
import type { StatusAction } from "../hooks/use-board-document-mutations";

interface BoardDocumentsTableProps {
  documents: DocumentDto[];
  onStatusChange: (docId: string, action: StatusAction) => void;
  onDetails: (docId: string) => void;
  onDelete: (docId: string) => void;
}

/**
 * Board documents table (E29-S3). Markup/classes preserved verbatim from the
 * god-page (`page.tsx:542-663`). The status-action affordances are gated by the
 * `DocumentStatus` enum exactly as the god-page's string-literal checks (AC-7,
 * no behaviour change): Draft → Mark-Reviewed + Publish; Reviewed → Publish +
 * Archive; Published → Archive. Details navigates to the detail route; Delete
 * opens the destructive confirm dialog in the parent (A86).
 */
export function BoardDocumentsTable({
  documents,
  onStatusChange,
  onDetails,
  onDelete,
}: BoardDocumentsTableProps) {
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
              {t("documents.status")}
            </th>
            <th className="hidden px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase md:table-cell">
              {t("documents.category")}
            </th>
            <th className="hidden px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase lg:table-cell">
              {t("documents.size")}
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
              </td>
              <td className="hidden px-6 py-4 md:table-cell">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(doc.status)}`}
                >
                  {doc.status}
                </span>
              </td>
              <td className="hidden px-6 py-4 md:table-cell">
                <span className="text-sm text-gray-600">{doc.category}</span>
              </td>
              <td className="hidden px-6 py-4 lg:table-cell">
                <span className="text-sm text-gray-600">
                  {formatFileSize(doc.fileSize)}
                </span>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  {doc.status === DocumentStatus.Draft && (
                    <>
                      <button
                        onClick={() => onStatusChange(doc.id, "review")}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800"
                      >
                        {t("documents.markReviewed")}
                      </button>
                      <button
                        onClick={() => onStatusChange(doc.id, "publish")}
                        className="text-xs font-medium text-green-600 hover:text-green-800"
                      >
                        {t("documents.publish")}
                      </button>
                    </>
                  )}
                  {doc.status === DocumentStatus.Reviewed && (
                    <button
                      onClick={() => onStatusChange(doc.id, "publish")}
                      className="text-xs font-medium text-green-600 hover:text-green-800"
                    >
                      {t("documents.publish")}
                    </button>
                  )}
                  {(doc.status === DocumentStatus.Published ||
                    doc.status === DocumentStatus.Reviewed) && (
                    <button
                      onClick={() => onStatusChange(doc.id, "archive")}
                      className="text-xs font-medium text-yellow-600 hover:text-yellow-800"
                    >
                      {t("documents.archive")}
                    </button>
                  )}
                  <button
                    onClick={() => onDetails(doc.id)}
                    className="text-xs font-medium text-orange-600 hover:text-orange-800"
                  >
                    {t("common.details")}
                  </button>
                  <button
                    onClick={() => onDelete(doc.id)}
                    className="text-xs font-medium text-red-600 hover:text-red-800"
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
