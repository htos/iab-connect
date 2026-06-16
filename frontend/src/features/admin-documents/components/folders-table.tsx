"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { DocumentFolderDto } from "../types/admin-documents.types";

interface FoldersTableProps {
  folders: DocumentFolderDto[];
  // parentId -> subfolder count (god-page's count probe cache).
  subfolderCounts: Record<string, number>;
  onOpen: (folder: DocumentFolderDto) => void;
  onEdit: (folder: DocumentFolderDto) => void;
  onPermissions: (folder: DocumentFolderDto) => void;
  onDelete: (folderId: string) => void;
}

/**
 * Folder table (E27-S6). Preserves the god-page table verbatim (E27-S1 net): a
 * clickable folder name (drill-down) with an optional subfolder-count hint, a
 * description column, the permission chips, and the per-row Edit / Permissions /
 * Delete actions.
 *
 * A77/DEC-2: the permission chips were raw `bg-blue-100 text-blue-700`; they now
 * use the token-backed `Badge` primitive (`variant="secondary"`) — no raw blue —
 * keeping the "<Role>: <Type>" text the net asserts.
 */
export function FoldersTable({
  folders,
  subfolderCounts,
  onOpen,
  onEdit,
  onPermissions,
  onDelete,
}: FoldersTableProps) {
  const t = useTranslations();

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
              {t("documents.folderName")}
            </th>
            <th className="hidden px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase md:table-cell">
              {t("documents.description")}
            </th>
            <th className="hidden px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase md:table-cell">
              {t("documents.permissions")}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
              {t("common.actions")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {folders.map((folder) => (
            <tr key={folder.id} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <button
                  onClick={() => onOpen(folder)}
                  className="group flex items-center gap-2 text-left"
                  title={t("documents.openFolder")}
                >
                  <svg
                    className="h-5 w-5 shrink-0 text-orange-500 group-hover:text-orange-700"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                  </svg>
                  <div>
                    <span className="font-medium text-gray-900 group-hover:text-orange-700 group-hover:underline">
                      {folder.name}
                    </span>
                    {(subfolderCounts[folder.id] ?? 0) > 0 && (
                      <span className="ml-2 text-xs text-gray-400">
                        (
                        {t("documents.subfolderCount", {
                          count: subfolderCounts[folder.id],
                        })}
                        )
                      </span>
                    )}
                  </div>
                </button>
              </td>
              <td className="hidden px-6 py-4 md:table-cell">
                <span className="text-sm text-gray-600">
                  {folder.description || "-"}
                </span>
              </td>
              <td className="hidden px-6 py-4 md:table-cell">
                <div className="flex flex-wrap gap-1">
                  {folder.permissions.length === 0 ? (
                    <span className="text-xs text-gray-400">
                      {t("documents.noPermissionsSet")}
                    </span>
                  ) : (
                    folder.permissions.map((p) => (
                      <Badge key={p.role} variant="secondary">
                        {p.role}: {p.permissionType}
                      </Badge>
                    ))
                  )}
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onEdit(folder)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800"
                  >
                    {t("common.edit")}
                  </button>
                  <button
                    onClick={() => onPermissions(folder)}
                    className="text-sm font-medium text-orange-600 hover:text-orange-800"
                  >
                    {t("documents.permissions")}
                  </button>
                  <button
                    onClick={() => onDelete(folder.id)}
                    className="text-sm font-medium text-red-600 hover:text-red-800"
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
