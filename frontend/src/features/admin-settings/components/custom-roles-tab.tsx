"use client";

/**
 * Custom Roles tab (E27-S3). Behaviour preserved verbatim from the god-page Custom
 * Roles tab (pinned by the E27-S1 net): the table, the linked-role + active badges
 * (now via `custom-role-badge`, A77), the role colour swatch (inline style from user
 * data), the New-Role button → create modal, the edit button → edit modal, the inline
 * delete-confirm → DELETE, the empty + loading states, and the persistent banner.
 *
 * The create/edit/delete server calls + the persistent banner state are owned by the
 * parent `admin-settings-page-content` (one banner per tab) and threaded as props so
 * the success/error semantics match the god-page exactly.
 */

import { useTranslations } from "next-intl";
import type { CustomRole } from "../types/admin-settings.types";
import { ActiveBadge, LinkedRoleBadge } from "./custom-role-badge";

interface CustomRolesTabProps {
  roles: CustomRole[];
  loading: boolean;
  message: { type: "success" | "error"; text: string } | null;
  deleteConfirmId: string | null;
  onNewRole: () => void;
  onEditRole: (role: CustomRole) => void;
  onArmDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (id: string) => void;
}

export function CustomRolesTab({
  roles,
  loading,
  message,
  deleteConfirmId,
  onNewRole,
  onEditRole,
  onArmDelete,
  onCancelDelete,
  onConfirmDelete,
}: CustomRolesTabProps) {
  const t = useTranslations("settings");

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      {message && (
        <div
          className={`mb-6 rounded-lg p-4 text-sm ${
            message.type === "success"
              ? "border border-green-200 bg-green-50 text-green-800"
              : "border border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Header with New Role button */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {t("customRoles")}
        </h2>
        <button
          onClick={onNewRole}
          className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 font-medium text-white transition-colors hover:bg-orange-700"
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
              d="M12 4v16m8-8H4"
            />
          </svg>
          {t("newRole")}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-orange-600"></div>
        </div>
      ) : roles.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          <p className="font-medium">{t("noRoles")}</p>
          <p className="mt-1 text-sm">{t("noRolesDescription")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  {t("roleName")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  {t("roleDescription")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  {t("linkedRole")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  {t("isActive")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  {t("color")}
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">
                  {t("actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr
                  key={role.id}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {role.name}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-gray-600">
                    {role.description}
                  </td>
                  <td className="px-4 py-3">
                    <LinkedRoleBadge role={role.linkedRole} />
                  </td>
                  <td className="px-4 py-3">
                    <ActiveBadge
                      isActive={role.isActive}
                      activeLabel={t("active")}
                      inactiveLabel={t("inactive")}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-5 w-5 rounded-full border border-gray-200"
                        style={{ backgroundColor: role.color }}
                      />
                      <span className="font-mono text-xs text-gray-500">
                        {role.color}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onEditRole(role)}
                        className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-orange-50 hover:text-orange-600"
                        title={t("editRole")}
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
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      {deleteConfirmId === role.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => onConfirmDelete(role.id)}
                            className="rounded bg-red-600 px-2 py-1 text-xs text-white transition-colors hover:bg-red-700"
                          >
                            {t("deleteRole")}
                          </button>
                          <button
                            onClick={onCancelDelete}
                            className="rounded border border-gray-300 px-2 py-1 text-xs transition-colors hover:bg-gray-50"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onArmDelete(role.id)}
                          className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
                          title={t("deleteRole")}
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
      )}
    </div>
  );
}
