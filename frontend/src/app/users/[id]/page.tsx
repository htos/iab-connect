"use client";

/**
 * User Edit Page
 * REQ-002: Benutzerverwaltung
 */

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  getUser,
  updateUser,
  updateUserRoles,
  getAvailableRoles,
  User,
  Role,
  UpdateUserRequest,
} from "@/lib/api/users";

export default function UserEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: userId } = use(params);
  const t = useTranslations("users");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, isAdmin, accessToken } = useAuth();

  const [user, setUser] = useState<User | null>(null);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<{
    email: string;
    firstName: string;
    lastName: string;
    enabled: boolean;
    emailVerified: boolean;
    roles: string[];
  }>({
    email: "",
    firstName: "",
    lastName: "",
    enabled: true,
    emailVerified: false,
    roles: [],
  });

  // Fetch user and roles
  useEffect(() => {
    async function fetchData() {
      if (!accessToken) return;

      setIsLoading(true);
      setError(null);

      try {
        const [userData, rolesData] = await Promise.all([
          getUser(accessToken, userId),
          getAvailableRoles(accessToken),
        ]);

        setUser(userData);
        setAvailableRoles(rolesData);
        setFormData({
          email: userData.email || "",
          firstName: userData.firstName || "",
          lastName: userData.lastName || "",
          enabled: userData.enabled,
          emailVerified: userData.emailVerified,
          roles: userData.roles,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load user");
      } finally {
        setIsLoading(false);
      }
    }

    if (isAuthenticated && isAdmin && accessToken) {
      fetchData();
    }
  }, [isAuthenticated, isAdmin, accessToken, userId]);

  // Redirect if not admin
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  // Handle form input change
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // Handle role toggle
  const handleRoleToggle = (roleName: string) => {
    setFormData((prev) => ({
      ...prev,
      roles: prev.roles.includes(roleName)
        ? prev.roles.filter((r) => r !== roleName)
        : [...prev.roles, roleName],
    }));
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !user) return;

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Update user details
      const updateRequest: UpdateUserRequest = {
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        enabled: formData.enabled,
        emailVerified: formData.emailVerified,
      };

      await updateUser(accessToken, userId, updateRequest);

      // Update roles if changed
      const currentRoles = new Set(user.roles);
      const newRoles = new Set(formData.roles);
      const rolesChanged =
        currentRoles.size !== newRoles.size ||
        [...currentRoles].some((r) => !newRoles.has(r));

      if (rolesChanged) {
        await updateUserRoles(accessToken, userId, formData.roles);
      }

      // Refresh user data
      const updatedUser = await getUser(accessToken, userId);
      setUser(updatedUser);
      setFormData({
        email: updatedUser.email || "",
        firstName: updatedUser.firstName || "",
        lastName: updatedUser.lastName || "",
        enabled: updatedUser.enabled,
        emailVerified: updatedUser.emailVerified,
        roles: updatedUser.roles,
      });

      setSuccessMessage(t("userUpdated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">{t("userNotFound")}</h2>
          <Link href="/users" className="text-orange-600 hover:underline mt-4 block">
            {t("backToUsers")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Back Link */}
        <Link
          href="/users"
          className="text-orange-600 hover:underline flex items-center gap-1 mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t("backToUsers")}
        </Link>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{t("editUser")}</h1>
          <p className="text-gray-600">{user.email}</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
            <button onClick={() => setError(null)} className="float-right font-bold">
              ×
            </button>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            {successMessage}
            <button onClick={() => setSuccessMessage(null)} className="float-right font-bold">
              ×
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              {t("email")} *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* First Name */}
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
              {t("firstName")}
            </label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* Last Name */}
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
              {t("lastName")}
            </label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* Status */}
          <div className="flex items-center gap-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="enabled"
                checked={formData.enabled}
                onChange={handleChange}
                className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">{t("userEnabled")}</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                name="emailVerified"
                checked={formData.emailVerified}
                onChange={handleChange}
                className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">{t("emailVerified")}</span>
            </label>
          </div>

          {/* Roles */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("roles")}
            </label>
            <div className="space-y-2">
              {availableRoles.map((role) => (
                <label key={role.name} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.roles.includes(role.name)}
                    onChange={() => handleRoleToggle(role.name)}
                    className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {role.name}
                    {role.description && (
                      <span className="text-gray-500 ml-1">({role.description})</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Metadata */}
          <div className="pt-4 border-t border-gray-200">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">{t("userId")}</dt>
                <dd className="text-gray-900 font-mono text-xs">{user.id}</dd>
              </div>
              <div>
                <dt className="text-gray-500">{t("createdAt")}</dt>
                <dd className="text-gray-900">
                  {user.createdAt
                    ? new Date(user.createdAt).toLocaleDateString("de-CH", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "-"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={() => router.push("/users")}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {tCommon("cancel")}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {tCommon("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
