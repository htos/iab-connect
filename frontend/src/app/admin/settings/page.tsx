"use client";

/**
 * Admin Settings Page
 * REQ-004: Administration - System Settings & Custom Roles
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth, useApiClient } from "@/lib/auth";
import { useAppSettings } from "@/components/providers/AppSettingsProvider";

// --- Types ---

interface SystemSettings {
  id: string;
  applicationName: string;
  logoText: string;
  logoBackgroundColor: string;
  logoTextColor: string;
  updatedAt: string;
  updatedBy: string;
}

interface CustomRole {
  id: string;
  name: string;
  description: string;
  linkedRole: "Admin" | "Vorstand" | "Member";
  isActive: boolean;
  color: string;
  sortOrder: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

interface CustomRoleForm {
  name: string;
  description: string;
  linkedRole: "Admin" | "Vorstand" | "Member";
  color: string;
  sortOrder: number;
  isActive: boolean;
}

type Tab = "general" | "customRoles";

// --- Component ---

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, isAdmin } = useAuth();
  const api = useApiClient();
  const { refresh: refreshAppSettings } = useAppSettings();

  // Stable refs for callbacks to avoid infinite loops
  const apiRef = useRef(api);
  const tRef = useRef(t);

  useEffect(() => {
    apiRef.current = api;
    tRef.current = t;
  });

  const [activeTab, setActiveTab] = useState<Tab>("general");

  // --- General settings state ---
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [settingsForm, setSettingsForm] = useState({
    applicationName: "",
    logoText: "",
    logoBackgroundColor: "#ea580c",
    logoTextColor: "#ffffff",
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // --- Custom roles state ---
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesMessage, setRolesMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [roleForm, setRoleForm] = useState<CustomRoleForm>({
    name: "",
    description: "",
    linkedRole: "Member",
    color: "#ea580c",
    sortOrder: 0,
    isActive: true,
  });
  const [roleSaving, setRoleSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // --- Auth redirect ---
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  // --- Load settings ---
  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    const { data, error } =
      await apiRef.current.get<SystemSettings>("/api/v1/settings");
    if (error) {
      setSettingsMessage({ type: "error", text: tRef.current("loadError") });
    } else if (data) {
      setSettings(data);
      setSettingsForm({
        applicationName: data.applicationName,
        logoText: data.logoText,
        logoBackgroundColor: data.logoBackgroundColor,
        logoTextColor: data.logoTextColor,
      });
    }
    setSettingsLoading(false);
  }, []);

  // --- Load custom roles ---
  const loadRoles = useCallback(async () => {
    setRolesLoading(true);
    const { data, error } = await apiRef.current.get<CustomRole[]>(
      "/api/v1/custom-roles"
    );
    if (error) {
      setRolesMessage({ type: "error", text: tRef.current("rolesLoadError") });
    } else if (data) {
      setRoles(data);
    }
    setRolesLoading(false);
  }, []);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      apiRef.current.get<SystemSettings>("/api/v1/settings").then(({ data, error }) => {
        if (error) {
          setSettingsMessage({ type: "error", text: tRef.current("loadError") });
        } else if (data) {
          setSettings(data);
          setSettingsForm({
            applicationName: data.applicationName,
            logoText: data.logoText,
            logoBackgroundColor: data.logoBackgroundColor,
            logoTextColor: data.logoTextColor,
          });
        }
        setSettingsLoading(false);
      });
      apiRef.current.get<CustomRole[]>("/api/v1/custom-roles").then(({ data, error }) => {
        if (error) {
          setRolesMessage({ type: "error", text: tRef.current("rolesLoadError") });
        } else if (data) {
          setRoles(data);
        }
        setRolesLoading(false);
      });
    }
  }, [isAuthenticated, isAdmin]);

  // --- Save settings ---
  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    setSettingsMessage(null);
    const { error } = await api.put<SystemSettings>(
      "/api/v1/settings",
      settingsForm
    );
    if (error) {
      setSettingsMessage({ type: "error", text: t("saveError") });
    } else {
      setSettingsMessage({ type: "success", text: t("saveSuccess") });
      await loadSettings();
      refreshAppSettings();
    }
    setSettingsSaving(false);
  };

  // --- Role CRUD ---
  const openNewRoleModal = () => {
    setEditingRole(null);
    setRoleForm({
      name: "",
      description: "",
      linkedRole: "Member",
      color: "#ea580c",
      sortOrder: roles.length,
      isActive: true,
    });
    setShowRoleModal(true);
  };

  const openEditRoleModal = (role: CustomRole) => {
    setEditingRole(role);
    setRoleForm({
      name: role.name,
      description: role.description,
      linkedRole: role.linkedRole,
      color: role.color,
      sortOrder: role.sortOrder,
      isActive: role.isActive,
    });
    setShowRoleModal(true);
  };

  const handleSaveRole = async () => {
    setRoleSaving(true);
    setRolesMessage(null);

    if (editingRole) {
      const { error } = await api.put<CustomRole>(
        `/api/v1/custom-roles/${editingRole.id}`,
        roleForm
      );
      if (error) {
        setRolesMessage({ type: "error", text: t("roleError") });
      } else {
        setRolesMessage({ type: "success", text: t("roleUpdateSuccess") });
        setShowRoleModal(false);
        await loadRoles();
      }
    } else {
      const { name, description, linkedRole, color, sortOrder } = roleForm;
      const { error } = await api.post<CustomRole>("/api/v1/custom-roles", {
        name,
        description,
        linkedRole,
        color,
        sortOrder,
      });
      if (error) {
        setRolesMessage({ type: "error", text: t("roleError") });
      } else {
        setRolesMessage({ type: "success", text: t("roleCreateSuccess") });
        setShowRoleModal(false);
        await loadRoles();
      }
    }

    setRoleSaving(false);
  };

  const handleDeleteRole = async (id: string) => {
    setRolesMessage(null);
    const { error } = await api.delete<void>(`/api/v1/custom-roles/${id}`);
    if (error) {
      setRolesMessage({ type: "error", text: t("roleError") });
    } else {
      setRolesMessage({ type: "success", text: t("roleDeleteSuccess") });
      await loadRoles();
    }
    setDeleteConfirmId(null);
  };

  // --- Loading / auth guard ---
  if (authLoading) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex min-h-100 items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  // --- Linked role badge color ---
  const linkedRoleBadgeColor = (role: "Admin" | "Vorstand" | "Member") => {
    switch (role) {
      case "Admin":
        return "bg-red-100 text-red-800";
      case "Vorstand":
        return "bg-blue-100 text-blue-800";
      case "Member":
        return "bg-green-100 text-green-800";
    }
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        {/* Back link */}
        <Link
          href="/admin"
          className="mb-6 inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {t("backToAdmin")}
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-1 text-gray-600">{t("subtitle")}</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab("general")}
            className={`border-b-2 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === "general"
                ? "border-orange-600 text-orange-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            {t("tabGeneral")}
          </button>
          <button
            onClick={() => setActiveTab("customRoles")}
            className={`border-b-2 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === "customRoles"
                ? "border-orange-600 text-orange-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            {t("tabCustomRoles")}
          </button>
        </div>

        {/* ===================== General Tab ===================== */}
        {activeTab === "general" && (
          <div className="rounded-xl bg-white p-6 shadow-sm">
            {settingsMessage && (
              <div
                className={`mb-6 rounded-lg p-4 text-sm ${
                  settingsMessage.type === "success"
                    ? "border border-green-200 bg-green-50 text-green-800"
                    : "border border-red-200 bg-red-50 text-red-800"
                }`}
              >
                {settingsMessage.text}
              </div>
            )}

            {settingsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-orange-600"></div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Application Name */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("applicationName")}
                  </label>
                  <input
                    type="text"
                    value={settingsForm.applicationName}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({
                        ...prev,
                        applicationName: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* Logo Text */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("logoText")}
                  </label>
                  <input
                    type="text"
                    maxLength={5}
                    value={settingsForm.logoText}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({
                        ...prev,
                        logoText: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {t("logoTextHint")}
                  </p>
                </div>

                {/* Color pickers row */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {/* Logo Background Color */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t("logoBackgroundColor")}
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={settingsForm.logoBackgroundColor}
                        onChange={(e) =>
                          setSettingsForm((prev) => ({
                            ...prev,
                            logoBackgroundColor: e.target.value,
                          }))
                        }
                        className="h-10 w-14 cursor-pointer rounded border border-gray-300"
                      />
                      <input
                        type="text"
                        value={settingsForm.logoBackgroundColor}
                        onChange={(e) =>
                          setSettingsForm((prev) => ({
                            ...prev,
                            logoBackgroundColor: e.target.value,
                          }))
                        }
                        className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-mono text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>

                  {/* Logo Text Color */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t("logoTextColor")}
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={settingsForm.logoTextColor}
                        onChange={(e) =>
                          setSettingsForm((prev) => ({
                            ...prev,
                            logoTextColor: e.target.value,
                          }))
                        }
                        className="h-10 w-14 cursor-pointer rounded border border-gray-300"
                      />
                      <input
                        type="text"
                        value={settingsForm.logoTextColor}
                        onChange={(e) =>
                          setSettingsForm((prev) => ({
                            ...prev,
                            logoTextColor: e.target.value,
                          }))
                        }
                        className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-mono text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Logo Preview */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-gray-700">
                    {t("logoPreview")}
                  </label>
                  <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                      style={{
                        backgroundColor: settingsForm.logoBackgroundColor,
                        color: settingsForm.logoTextColor,
                      }}
                    >
                      {settingsForm.logoText || "IAB"}
                    </div>
                    <span className="font-medium text-gray-700">
                      {settingsForm.applicationName || "IAB Connect"}
                    </span>
                  </div>
                </div>

                {/* Save */}
                <div className="flex justify-end border-t border-gray-200 pt-4">
                  <button
                    onClick={handleSaveSettings}
                    disabled={settingsSaving}
                    className="rounded-lg bg-orange-600 px-6 py-2 font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
                  >
                    {settingsSaving ? t("saving") : t("saveSettings")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================== Custom Roles Tab ===================== */}
        {activeTab === "customRoles" && (
          <div className="rounded-xl bg-white p-6 shadow-sm">
            {rolesMessage && (
              <div
                className={`mb-6 rounded-lg p-4 text-sm ${
                  rolesMessage.type === "success"
                    ? "border border-green-200 bg-green-50 text-green-800"
                    : "border border-red-200 bg-red-50 text-red-800"
                }`}
              >
                {rolesMessage.text}
              </div>
            )}

            {/* Header with New Role button */}
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {t("customRoles")}
              </h2>
              <button
                onClick={openNewRoleModal}
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

            {rolesLoading ? (
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
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${linkedRoleBadgeColor(role.linkedRole)}`}
                          >
                            {role.linkedRole}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                              role.isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {role.isActive ? t("active") : t("inactive")}
                          </span>
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
                              onClick={() => openEditRoleModal(role)}
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
                                  onClick={() => handleDeleteRole(role.id)}
                                  className="rounded bg-red-600 px-2 py-1 text-xs text-white transition-colors hover:bg-red-700"
                                >
                                  {t("deleteRole")}
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="rounded border border-gray-300 px-2 py-1 text-xs transition-colors hover:bg-gray-50"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmId(role.id)}
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
        )}

        {/* ===================== Role Modal ===================== */}
        {showRoleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowRoleModal(false)}
            />

            {/* Modal */}
            <div className="relative mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
              <h3 className="mb-6 text-lg font-semibold text-gray-900">
                {editingRole ? t("editRole") : t("createRole")}
              </h3>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("roleName")}
                  </label>
                  <input
                    type="text"
                    value={roleForm.name}
                    onChange={(e) =>
                      setRoleForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("roleDescription")}
                  </label>
                  <textarea
                    value={roleForm.description}
                    onChange={(e) =>
                      setRoleForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    rows={3}
                    className="w-full resize-none rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* Linked Role */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("linkedRole")}
                  </label>
                  <select
                    value={roleForm.linkedRole}
                    onChange={(e) =>
                      setRoleForm((prev) => ({
                        ...prev,
                        linkedRole: e.target.value as
                          | "Admin"
                          | "Vorstand"
                          | "Member",
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Vorstand">Vorstand</option>
                    <option value="Member">Member</option>
                  </select>
                </div>

                {/* Color & Sort Order row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t("color")}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={roleForm.color}
                        onChange={(e) =>
                          setRoleForm((prev) => ({
                            ...prev,
                            color: e.target.value,
                          }))
                        }
                        className="h-10 w-12 cursor-pointer rounded border border-gray-300"
                      />
                      <input
                        type="text"
                        value={roleForm.color}
                        onChange={(e) =>
                          setRoleForm((prev) => ({
                            ...prev,
                            color: e.target.value,
                          }))
                        }
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t("sortOrder")}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={roleForm.sortOrder}
                      onChange={(e) =>
                        setRoleForm((prev) => ({
                          ...prev,
                          sortOrder: parseInt(e.target.value) || 0,
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                {/* Is Active */}
                {editingRole && (
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="roleIsActive"
                      checked={roleForm.isActive}
                      onChange={(e) =>
                        setRoleForm((prev) => ({
                          ...prev,
                          isActive: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                    />
                    <label
                      htmlFor="roleIsActive"
                      className="text-sm font-medium text-gray-700"
                    >
                      {t("isActive")}
                    </label>
                  </div>
                )}
              </div>

              {/* Modal actions */}
              <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-4">
                <button
                  onClick={() => setShowRoleModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 font-medium transition-colors hover:bg-gray-50"
                >
                  {tCommon("cancel")}
                </button>
                <button
                  onClick={handleSaveRole}
                  disabled={roleSaving || !roleForm.name.trim()}
                  className="rounded-lg bg-orange-600 px-6 py-2 font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
                >
                  {roleSaving
                    ? t("saving")
                    : editingRole
                      ? t("editRole")
                      : t("createRole")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete confirmation modal */}
        {deleteConfirmId && (
          <div className="sr-only" aria-live="assertive">
            {t("deleteRoleConfirm")}
          </div>
        )}
      </div>
    </main>
  );
}
