"use client";

/**
 * User Management Page
 * REQ-002: Benutzerverwaltung
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import {
  getUsers,
  setUserEnabled,
  sendPasswordReset,
  resetUserMfa,
  deleteUser,
  User,
  UserListResponse,
  getRoleDisplayName,
  getRoleColor,
} from "@/lib/api/users";

export default function UsersPage() {
  const t = useTranslations("users");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, isAdmin, accessToken } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    if (!accessToken) return;

    setIsLoading(true);
    setError(null);

    try {
      const response: UserListResponse = await getUsers(accessToken, {
        search: search || undefined,
        page,
        pageSize,
      });
      setUsers(response.users);
      setTotalCount(response.totalCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, search, page, pageSize]);

  useEffect(() => {
    if (isAuthenticated && isAdmin && accessToken) {
      fetchUsers();
    }
  }, [isAuthenticated, isAdmin, accessToken, fetchUsers]);

  // Redirect if not admin
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  // Handle enable/disable user
  const handleToggleEnabled = async (user: User) => {
    if (!accessToken) return;

    setActionLoading(user.id);
    try {
      const updatedUser = await setUserEnabled(accessToken, user.id, !user.enabled);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? updatedUser : u))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setActionLoading(null);
    }
  };

  // Handle password reset
  const handlePasswordReset = async (user: User) => {
    if (!accessToken) return;

    if (!confirm(t("confirmPasswordReset", { email: user.email ?? "" }))) {
      return;
    }

    setActionLoading(user.id);
    try {
      await sendPasswordReset(accessToken, user.id);
      alert(t("passwordResetSent"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send password reset");
    } finally {
      setActionLoading(null);
    }
  };

  // Handle MFA reset
  const handleMfaReset = async (user: User) => {
    if (!accessToken) return;

    if (!confirm(t("confirmMfaReset", { email: user.email ?? "" }))) {
      return;
    }

    setActionLoading(user.id);
    try {
      await resetUserMfa(accessToken, user.id);
      alert(t("mfaResetSent"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset MFA");
    } finally {
      setActionLoading(null);
    }
  };

  // Handle delete user
  const handleDelete = async (user: User) => {
    if (!accessToken) return;

    if (!confirm(t("confirmDelete", { email: user.email ?? "" }))) {
      return;
    }

    setActionLoading(user.id);
    try {
      await deleteUser(accessToken, user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setTotalCount((prev) => prev - 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setActionLoading(null);
    }
  };

  // Calculate pagination
  const totalPages = Math.ceil(totalCount / pageSize);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t("backToAdmin")}
        </Link>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{t("title")}</h1>
            <p className="text-gray-600 mt-1">
              {t("totalUsers", { count: totalCount })}
            </p>
          </div>
          <button
            onClick={() => router.push("/admin/users/new")}
            className="bg-orange-600 text-white px-4 py-2 rounded-xl hover:bg-orange-700 transition-colors flex items-center gap-2 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            {t("createUser")}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700 font-bold ml-4"
            >
              ×
            </button>
          </div>
        )}

        {/* Search */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
            <button
              type="submit"
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-300 transition-colors focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
            >
              {tCommon("search")}
            </button>
          </div>
        </form>

        {/* Users Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("user")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("roles")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("status")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("createdAt")}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("actions")}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr
                  key={user.id}
                  className={`hover:bg-gray-50 ${
                    !user.enabled ? "opacity-60" : ""
                  }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                          <span className="text-orange-600 font-medium">
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
                        <span
                          key={role}
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            getRoleColor(role) === "red"
                              ? "bg-red-100 text-red-800"
                              : getRoleColor(role) === "blue"
                              ? "bg-blue-100 text-blue-800"
                              : getRoleColor(role) === "green"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {getRoleDisplayName(role)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.enabled
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {user.enabled ? t("active") : t("inactive")}
                    </span>
                    {user.emailVerified && (
                      <span className="ml-2 text-green-500" title={t("emailVerified")}>
                        ✓
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.createdAt
                      ? new Date(user.createdAt).toLocaleDateString("de-CH")
                      : "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => router.push(`/admin/users/${user.id}`)}
                        className="text-orange-600 hover:text-orange-900"
                        title={tCommon("edit")}
                      >
                        <svg
                          className="w-5 h-5"
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
                        onClick={() => handleToggleEnabled(user)}
                        disabled={actionLoading === user.id}
                        className={`${
                          user.enabled
                            ? "text-red-600 hover:text-red-900"
                            : "text-green-600 hover:text-green-900"
                        }`}
                        title={user.enabled ? t("disable") : t("enable")}
                      >
                        {actionLoading === user.id ? (
                          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : user.enabled ? (
                          <svg
                            className="w-5 h-5"
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
                            className="w-5 h-5"
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
                        onClick={() => handlePasswordReset(user)}
                        disabled={actionLoading === user.id}
                        className="text-blue-600 hover:text-blue-900"
                        title={t("resetPassword")}
                      >
                        <svg
                          className="w-5 h-5"
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
                        onClick={() => handleMfaReset(user)}
                        disabled={actionLoading === user.id}
                        className="text-orange-600 hover:text-orange-900"
                        title={t("resetMfa")}
                      >
                        <svg
                          className="w-5 h-5"
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
                        onClick={() => handleDelete(user)}
                        disabled={actionLoading === user.id}
                        className="text-red-600 hover:text-red-900"
                        title={tCommon("delete")}
                      >
                        <svg
                          className="w-5 h-5"
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

          {users.length === 0 && !isLoading && (
            <div className="text-center py-12 text-gray-500">
              {search ? t("noUsersFound") : t("noUsers")}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              {t("showing", {
                from: (page - 1) * pageSize + 1,
                to: Math.min(page * pageSize, totalCount),
                total: totalCount,
              })}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
              >
                {tCommon("previous")}
              </button>
              <span className="px-3 py-1">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 border rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
              >
                {tCommon("next")}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
