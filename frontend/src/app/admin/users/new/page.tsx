"use client";

/**
 * Create New User Page
 * REQ-002: Benutzerverwaltung
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  createUser,
  getAvailableRoles,
  Role,
  CreateUserRequest,
} from "@/lib/api/users";

export default function CreateUserPage() {
  const t = useTranslations("users");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, isAdmin, accessToken } = useAuth();

  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<{
    email: string;
    firstName: string;
    lastName: string;
    enabled: boolean;
    sendInvitation: boolean;
    temporaryPassword: string;
    roles: string[];
  }>({
    email: "",
    firstName: "",
    lastName: "",
    enabled: true,
    sendInvitation: true,
    temporaryPassword: "",
    roles: ["member"],
  });

  // Fetch available roles
  useEffect(() => {
    async function fetchRoles() {
      if (!accessToken) return;

      setIsLoading(true);
      try {
        const roles = await getAvailableRoles(accessToken);
        setAvailableRoles(roles);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load roles");
      } finally {
        setIsLoading(false);
      }
    }

    if (isAuthenticated && isAdmin && accessToken) {
      fetchRoles();
    }
  }, [isAuthenticated, isAdmin, accessToken]);

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
    if (!accessToken) return;

    // Validation
    if (!formData.email) {
      setError(t("emailRequired"));
      return;
    }

    if (!formData.sendInvitation && !formData.temporaryPassword) {
      setError(t("passwordOrInvitationRequired"));
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const request: CreateUserRequest = {
        email: formData.email,
        firstName: formData.firstName || undefined,
        lastName: formData.lastName || undefined,
        enabled: formData.enabled,
        sendInvitation: formData.sendInvitation,
        temporaryPassword: formData.temporaryPassword || undefined,
        roles: formData.roles.length > 0 ? formData.roles : undefined,
      };

      const newUser = await createUser(accessToken, request);
      router.push(`/admin/users/${newUser.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
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

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
      <div className="max-w-3xl mx-auto">
        {/* Back Link */}
        <Link
          href="/admin/users"
          className="text-orange-600 hover:underline flex items-center gap-1 mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t("backToUsers")}
        </Link>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{t("createUser")}</h1>
            <p className="text-gray-600 mt-1">{t("createUserDescription")}</p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 font-bold ml-4">
              ×
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-6">
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
              placeholder="user@example.com"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* Enabled */}
          <div>
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
          </div>

          {/* Invitation Options */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">{t("accountSetup")}</h3>

            <div className="space-y-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="sendInvitation"
                  checked={formData.sendInvitation}
                  onChange={handleChange}
                  className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">{t("sendInvitationEmail")}</span>
              </label>
              <p className="text-sm text-gray-500 ml-6">{t("sendInvitationDescription")}</p>

              {!formData.sendInvitation && (
                <div className="ml-6">
                  <label htmlFor="temporaryPassword" className="block text-sm font-medium text-gray-700">
                    {t("temporaryPassword")} *
                  </label>
                  <input
                    type="password"
                    id="temporaryPassword"
                    name="temporaryPassword"
                    value={formData.temporaryPassword}
                    onChange={handleChange}
                    required={!formData.sendInvitation}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                  <p className="text-sm text-gray-500 mt-1">{t("temporaryPasswordDescription")}</p>
                </div>
              )}
            </div>
          </div>

          {/* Roles */}
          <div className="border-t border-gray-200 pt-6">
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

          {/* Actions */}
          <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => router.push("/admin/users")}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
            >
              {tCommon("cancel")}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-white bg-orange-600 rounded-xl hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
            >
              {isSaving && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {t("createUser")}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
