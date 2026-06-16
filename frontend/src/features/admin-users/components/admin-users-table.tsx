import { useTranslations } from "next-intl";
import { UserRoleBadge } from "./user-role-badge";
import { UserStatusBadge } from "./user-status-badge";
import type { User } from "../types/admin-user.types";

interface AdminUsersTableProps {
  users: User[];
  // The id currently mid-action (spinner on its toggle button); null when idle.
  actionLoadingId: string | null;
  onEdit: (user: User) => void;
  onToggleEnabled: (user: User) => void;
  onPasswordReset: (user: User) => void;
  onMfaReset: (user: User) => void;
  onDelete: (user: User) => void;
}

// Admin users table. Markup preserved VERBATIM from the god-page list; the inline
// role/status colour spans are replaced by the feature-local badges (A77). The
// per-row action colours are preserved EXACTLY (A86): edit=orange, toggle=
// conditional red(enabled)/green(disabled), password-reset=blue, mfa-reset=
// orange, delete=red. The actual confirm/alert + transport wiring lives in the
// page-content (passed down as the on* handlers) — DEC-4 = A (no Radix upgrade).
export function AdminUsersTable({
  users,
  actionLoadingId,
  onEdit,
  onToggleEnabled,
  onPasswordReset,
  onMfaReset,
  onDelete,
}: AdminUsersTableProps) {
  const t = useTranslations("users");
  const tCommon = useTranslations("common");
  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
            {t("user")}
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
            {t("roles")}
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
            {t("status")}
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
            {t("createdAt")}
          </th>
          <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
            {t("actions")}
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200 bg-white">
        {users.map((user) => (
          <tr
            key={user.id}
            className={`hover:bg-gray-50 ${!user.enabled ? "opacity-60" : ""}`}
          >
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="flex items-center">
                <div className="h-10 w-10 shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                    <span className="font-medium text-orange-600">
                      {user.firstName?.[0] || user.email?.[0] || "?"}
                    </span>
                  </div>
                </div>
                <div className="ml-4">
                  <div className="text-sm font-medium text-gray-900">
                    {user.firstName} {user.lastName}
                  </div>
                  <div className="text-sm text-gray-500">{user.email}</div>
                </div>
              </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="flex flex-wrap gap-1">
                {user.roles.map((role) => (
                  <UserRoleBadge key={role} role={role} />
                ))}
              </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
              <UserStatusBadge
                enabled={user.enabled}
                emailVerified={user.emailVerified}
              />
            </td>
            <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
              {user.createdAt
                ? new Date(user.createdAt).toLocaleDateString("de-CH")
                : "-"}
            </td>
            <td className="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => onEdit(user)}
                  className="text-orange-600 hover:text-orange-900"
                  title={tCommon("edit")}
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
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => onToggleEnabled(user)}
                  disabled={actionLoadingId === user.id}
                  className={
                    user.enabled
                      ? "text-red-600 hover:text-red-900"
                      : "text-green-600 hover:text-green-900"
                  }
                  title={user.enabled ? t("disable") : t("enable")}
                >
                  {actionLoadingId === user.id ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : user.enabled ? (
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
                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                      />
                    </svg>
                  ) : (
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
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => onPasswordReset(user)}
                  disabled={actionLoadingId === user.id}
                  className="text-blue-600 hover:text-blue-900"
                  title={t("resetPassword")}
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
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => onMfaReset(user)}
                  disabled={actionLoadingId === user.id}
                  className="text-orange-600 hover:text-orange-900"
                  title={t("resetMfa")}
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
                      d="M12 11c.828 0 1.5-.672 1.5-1.5S12.828 8 12 8s-1.5.672-1.5 1.5S11.172 11 12 11zm0 0v3m0 0h.01M5 11V7a7 7 0 0114 0v4m-1 0h1a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-8a1 1 0 011-1h1z"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => onDelete(user)}
                  disabled={actionLoadingId === user.id}
                  className="text-red-600 hover:text-red-900"
                  title={tCommon("delete")}
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
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
