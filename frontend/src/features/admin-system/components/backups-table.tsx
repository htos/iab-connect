"use client";

/**
 * Backups table (E27-S4). Renders the list rows with status/type badges + the
 * per-row action affordances:
 *  - download (Completed only; token blob via the parent's handler)
 *  - restore (inline 2-button confirm; DEC-4 = A: trigger + confirm now RED — A86
 *    promotes restore, the highest-risk action, to a destructive affordance it
 *    lacked; failure keeps the confirm state, owned by the parent)
 *  - retry (Failed only; re-create with the failed row's notes)
 *  - delete (inline 2-button confirm, RED; failure keeps confirm state)
 *
 * Structure (titles, badges, columns) preserved verbatim from the god-page so the
 * E27-S1 backups net resolves every `findByTitle`/`findByText`. The inline-confirm
 * id state is lifted to the parent (it clears the id only on mutation success).
 */

import { useTranslations } from "next-intl";
import { formatFileSize } from "@/lib/api/backup";
import { BackupStatusBadge, BackupTypeBadge } from "./backup-badges";
import type { BackupDto } from "../types/backups.types";

interface BackupsTableProps {
  backups: BackupDto[];
  restoreConfirmId: string | null;
  deleteConfirmId: string | null;
  isRestoring: boolean;
  onDownload: (backup: BackupDto) => void;
  onRestoreConfirm: (id: string) => void;
  onRestore: (id: string) => void;
  onRestoreCancel: () => void;
  onRetry: (notes?: string) => void;
  onDeleteConfirm: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteCancel: () => void;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BackupsTable({
  backups,
  restoreConfirmId,
  deleteConfirmId,
  isRestoring,
  onDownload,
  onRestoreConfirm,
  onRestore,
  onRestoreCancel,
  onRetry,
  onDeleteConfirm,
  onDelete,
  onDeleteCancel,
}: BackupsTableProps) {
  const t = useTranslations("admin.backups");
  const tCommon = useTranslations("common");

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
              {t("table.fileName")}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
              {t("table.type")}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
              {t("table.status")}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
              {t("table.size")}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
              {t("table.createdAt")}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
              {t("table.createdBy")}
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
              {t("table.actions")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {backups.map((backup) => (
            <tr key={backup.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {backup.fileName}
                </div>
                {backup.notes && (
                  <div className="mt-1 text-xs text-gray-500">
                    {backup.notes}
                  </div>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <BackupTypeBadge
                  type={backup.type}
                  label={t(`types.${backup.type.toLowerCase()}`)}
                />
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <BackupStatusBadge
                  status={backup.status}
                  label={t(`statuses.${backup.status.toLowerCase()}`)}
                />
                {backup.errorMessage && (
                  <div
                    className="mt-1 text-xs text-red-500"
                    title={backup.errorMessage}
                  >
                    {backup.errorMessage.length > 50
                      ? `${backup.errorMessage.substring(0, 50)}...`
                      : backup.errorMessage}
                  </div>
                )}
                {backup.restoredAt && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-blue-600">
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    {t("restoredInfo", {
                      date: formatDate(backup.restoredAt),
                      user: backup.restoredBy ?? "–",
                    })}
                  </div>
                )}
              </td>
              <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                {backup.status === "Completed"
                  ? formatFileSize(backup.fileSizeBytes)
                  : "–"}
              </td>
              <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                {formatDate(backup.createdAt)}
              </td>
              <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                {backup.createdBy}
              </td>
              <td className="px-6 py-4 text-right text-sm whitespace-nowrap">
                <div className="flex items-center justify-end gap-2">
                  {backup.status === "Completed" && (
                    <button
                      onClick={() => onDownload(backup)}
                      className="p-1 text-orange-600 hover:text-orange-800"
                      title={t("actions.download")}
                    >
                      <svg
                        className="h-5 w-5"
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
                    </button>
                  )}
                  {backup.status === "Completed" &&
                    (restoreConfirmId === backup.id ? (
                      <div className="flex items-center gap-1">
                        {/* DEC-4 = A (A86): restore confirm is now RED. */}
                        <button
                          onClick={() => onRestore(backup.id)}
                          disabled={isRestoring}
                          className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          {isRestoring ? (
                            <div className="h-3 w-3 animate-spin rounded-full border-b-2 border-red-600"></div>
                          ) : (
                            tCommon("confirm")
                          )}
                        </button>
                        <button
                          onClick={onRestoreCancel}
                          className="rounded bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800"
                          disabled={isRestoring}
                        >
                          {tCommon("cancel")}
                        </button>
                      </div>
                    ) : (
                      /* DEC-4 = A (A86): restore trigger is now RED (was blue). */
                      <button
                        onClick={() => onRestoreConfirm(backup.id)}
                        className="p-1 text-red-600 hover:text-red-800"
                        title={t("actions.restore")}
                      >
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                      </button>
                    ))}
                  {backup.status === "Failed" && (
                    <button
                      onClick={() => onRetry(backup.notes ?? undefined)}
                      className="p-1 text-orange-600 hover:text-orange-800"
                      title={t("actions.retry")}
                    >
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                  )}
                  {deleteConfirmId === backup.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onDelete(backup.id)}
                        className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:text-red-800"
                      >
                        {tCommon("confirm")}
                      </button>
                      <button
                        onClick={onDeleteCancel}
                        className="rounded bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800"
                      >
                        {tCommon("cancel")}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onDeleteConfirm(backup.id)}
                      className="p-1 text-red-600 hover:text-red-800"
                      title={t("actions.delete")}
                    >
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
