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
  // REQ-086 (E9-S1): organization profile & branding — all nullable.
  description: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactAddress: string | null;
  primaryColor: string | null;
  publicSiteEnabled: boolean | null;
  logoUrl: string | null;
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

// REQ-087 (E10-S2): per-module enablement state from GET /api/v1/module-settings.
interface ModuleSetting {
  moduleKey: string;
  enabled: boolean;
  updatedAt: string;
  updatedBy: string | null;
}

type Tab = "branding" | "customRoles" | "modules";

// REQ-087 (E10-S2): canonical module keys, mirrored from backend `ModuleKeys`. Drives the
// Modules tab row order. There is no "admin" module — Admin is never gateable (AC-6).
const MODULE_KEYS = [
  "members",
  "events",
  "documents",
  "communication",
  "finance",
  "partners",
  "public_view",
] as const;

// REQ-087 (E10-S2): advisory cross-module dependency pairs. Disabling a key surfaces a
// warning when a listed dependent is still enabled. Full dependency *handling* is E10-S5;
// this is advisory only and never blocks the toggle.
const MODULE_DEPENDENCY_WARNINGS: Record<string, string[]> = {
  finance: ["events"],
  events: ["finance"],
};

// REQ-086 (E9-S1): logo upload sub-state surfaced inline in the Branding tab.
type LogoUploadState = "idle" | "uploading" | "failed" | "invalid";

interface SettingsForm {
  applicationName: string;
  logoText: string;
  logoBackgroundColor: string;
  logoTextColor: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  primaryColor: string;
  publicSiteEnabled: boolean;
}

// REQ-086 (E9-S1): map the API response into the editable form shape. Nullable profile
// fields map to "" (review patch): an untouched blank field is sent back as null on save
// so it stays "not configured" instead of persisting a concrete default.
function mapSettingsToForm(data: SystemSettings): SettingsForm {
  return {
    applicationName: data.applicationName,
    logoText: data.logoText,
    logoBackgroundColor: data.logoBackgroundColor,
    logoTextColor: data.logoTextColor,
    description: data.description ?? "",
    contactEmail: data.contactEmail ?? "",
    contactPhone: data.contactPhone ?? "",
    contactAddress: data.contactAddress ?? "",
    primaryColor: data.primaryColor ?? "",
    publicSiteEnabled: data.publicSiteEnabled ?? true,
  };
}

// REQ-086 (E9-S1): logo content-type allowlist + size cap, mirrored from the API.
const ALLOWED_LOGO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
];
const MAX_LOGO_SIZE_BYTES = 1 * 1024 * 1024;

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

  const [activeTab, setActiveTab] = useState<Tab>("branding");

  // --- Branding settings state ---
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [settingsForm, setSettingsForm] = useState({
    applicationName: "",
    logoText: "",
    logoBackgroundColor: "#ea580c",
    logoTextColor: "#ffffff",
    // REQ-086 (E9-S1): organization profile & branding fields.
    description: "",
    contactEmail: "",
    contactPhone: "",
    contactAddress: "",
    primaryColor: "#ea580c",
    publicSiteEnabled: true,
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // REQ-086 (E9-S1): staged logo file + upload sub-state.
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoUploadState, setLogoUploadState] =
    useState<LogoUploadState>("idle");
  // REQ-086 (E9-S1 review patch): the logo preview falls back to the text logo when the
  // stored asset fails to load (e.g. the asset is missing from storage).
  const [logoImgError, setLogoImgError] = useState(false);
  // REQ-086 (E9-S1 review patch): client-side field validation so a malformed value is
  // attributed to its field inline instead of discarding the whole save generically.
  const [fieldErrors, setFieldErrors] = useState<{
    primaryColor?: string;
    contactEmail?: string;
  }>({});

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

  // --- Module settings state (REQ-087 E10-S2) ---
  const [modules, setModules] = useState<ModuleSetting[]>([]);
  const [modulesLoading, setModulesLoading] = useState(true);
  // Key of the module whose PUT is in flight, and the key awaiting disable-confirmation.
  const [moduleSavingKey, setModuleSavingKey] = useState<string | null>(null);
  const [moduleConfirmKey, setModuleConfirmKey] = useState<string | null>(null);
  const [modulesMessage, setModulesMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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
      setSettingsForm(mapSettingsToForm(data));
      setLogoImgError(false);
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

  // --- Load module settings (REQ-087 E10-S2) ---
  // No synchronous setModulesLoading(true) here: `modulesLoading` starts true (initial
  // mount spinner) and this loader is also called from the mount effect — a sync setState
  // in an effect body is a cascading-render anti-pattern. Refresh-after-save updates the
  // rows in place without flashing the full-card spinner.
  const loadModules = useCallback(async () => {
    const { data, error } = await apiRef.current.get<ModuleSetting[]>(
      "/api/v1/module-settings"
    );
    if (error) {
      setModulesMessage({
        type: "error",
        text: tRef.current("modulesLoadError"),
      });
    } else if (data) {
      setModules(data);
    }
    setModulesLoading(false);
  }, []);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      apiRef.current
        .get<SystemSettings>("/api/v1/settings")
        .then(({ data, error }) => {
          if (error) {
            setSettingsMessage({
              type: "error",
              text: tRef.current("loadError"),
            });
          } else if (data) {
            setSettings(data);
            setSettingsForm(mapSettingsToForm(data));
            setLogoImgError(false);
          }
          setSettingsLoading(false);
        });
      apiRef.current
        .get<CustomRole[]>("/api/v1/custom-roles")
        .then(({ data, error }) => {
          if (error) {
            setRolesMessage({
              type: "error",
              text: tRef.current("rolesLoadError"),
            });
          } else if (data) {
            setRoles(data);
          }
          setRolesLoading(false);
        });
      // REQ-087 (E10-S2 review patch): call the shared loader instead of an inline
      // duplicate fetch — one GET per mount, no drift between two copies of the logic.
      void loadModules();
    }
  }, [isAuthenticated, isAdmin, loadModules]);

  // --- Stage a logo file (REQ-086 E9-S1) ---
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      return;
    }
    if (
      !ALLOWED_LOGO_TYPES.includes(file.type) ||
      file.size > MAX_LOGO_SIZE_BYTES
    ) {
      setLogoUploadState("invalid");
      setLogoFile(null);
      setLogoPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    setLogoUploadState("idle");
    setLogoImgError(false);
    setLogoFile(file);
    setLogoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  // --- Save settings (REQ-086 E9-S1: profile PUT + optional logo upload) ---
  const handleSaveSettings = async () => {
    // REQ-086 (E9-S1 review patch): validate locally first so a malformed value is
    // attributed to its field instead of failing the whole save with a generic error.
    const hexPattern = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
    const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    const primaryColor = settingsForm.primaryColor.trim();
    const contactEmail = settingsForm.contactEmail.trim();
    const nextFieldErrors: { primaryColor?: string; contactEmail?: string } =
      {};
    if (primaryColor && !hexPattern.test(primaryColor)) {
      nextFieldErrors.primaryColor = t("primaryColorInvalid");
    }
    if (contactEmail && !emailPattern.test(contactEmail)) {
      nextFieldErrors.contactEmail = t("contactEmailInvalid");
    }
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) {
      setSettingsMessage({ type: "error", text: t("validationError") });
      return;
    }

    setSettingsSaving(true);
    setSettingsMessage(null);
    // REQ-086 (E9-S1 review patch): send blank optional fields as null so an untouched /
    // cleared field stays NULL ("not configured") instead of persisting a concrete default.
    const profilePayload = {
      applicationName: settingsForm.applicationName,
      logoText: settingsForm.logoText,
      logoBackgroundColor: settingsForm.logoBackgroundColor,
      logoTextColor: settingsForm.logoTextColor,
      description: settingsForm.description.trim() || null,
      contactEmail: contactEmail || null,
      contactPhone: settingsForm.contactPhone.trim() || null,
      contactAddress: settingsForm.contactAddress.trim() || null,
      primaryColor: primaryColor || null,
      publicSiteEnabled: settingsForm.publicSiteEnabled,
    };
    const { error } = await api.put<SystemSettings>(
      "/api/v1/settings",
      profilePayload
    );
    if (error) {
      setSettingsMessage({ type: "error", text: t("saveError") });
      setSettingsSaving(false);
      return;
    }

    if (logoFile) {
      setLogoUploadState("uploading");
      const formData = new FormData();
      formData.append("file", logoFile);
      const { error: logoError } = await api.upload<{ logoUrl: string }>(
        "/api/v1/settings/logo",
        formData
      );
      if (logoError) {
        setLogoUploadState("failed");
        setSettingsMessage({ type: "error", text: t("logoUploadFailed") });
        setSettingsSaving(false);
        return;
      }
      setLogoUploadState("idle");
      setLogoFile(null);
      setLogoPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }

    setSettingsMessage({ type: "success", text: t("saveSuccess") });
    await loadSettings();
    refreshAppSettings();
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

  // --- Module enable/disable (REQ-087 E10-S2) ---
  const applyModuleChange = async (moduleKey: string, enabled: boolean) => {
    setModuleSavingKey(moduleKey);
    setModulesMessage(null);
    const { error } = await api.put<ModuleSetting>(
      `/api/v1/module-settings/${moduleKey}`,
      { enabled }
    );
    if (error) {
      // REQ-087 (E10-S2 review patch): keep the confirmation modal open on a failed
      // save so the error is shown where the user is acting, not behind the modal.
      setModulesMessage({ type: "error", text: t("moduleSaveError") });
      setModuleSavingKey(null);
      return;
    }
    setModulesMessage({ type: "success", text: t("moduleSaveSuccess") });
    await loadModules();
    // Sidebar/widgets read module state from AppSettingsProvider — refresh it.
    refreshAppSettings();
    setModuleSavingKey(null);
    setModuleConfirmKey(null);
  };

  const handleModuleToggle = (moduleKey: string, currentlyEnabled: boolean) => {
    if (currentlyEnabled) {
      // Disabling is the destructive direction — confirm before applying.
      setModuleConfirmKey(moduleKey);
    } else {
      void applyModuleChange(moduleKey, true);
    }
  };

  // Dependents of `moduleKey` that are still enabled — drives the advisory warning.
  const enabledDependents = (moduleKey: string): string[] =>
    (MODULE_DEPENDENCY_WARNINGS[moduleKey] ?? []).filter(
      (dep) => modules.find((m) => m.moduleKey === dep)?.enabled ?? false
    );

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
            onClick={() => setActiveTab("branding")}
            className={`border-b-2 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === "branding"
                ? "border-orange-600 text-orange-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            {t("tabBranding")}
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
          <button
            onClick={() => setActiveTab("modules")}
            className={`border-b-2 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === "modules"
                ? "border-orange-600 text-orange-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            {t("tabModules")}
          </button>
        </div>

        {/* ===================== Branding Tab ===================== */}
        {activeTab === "branding" && (
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

                {/* REQ-086: Primary brand color */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("primaryColor")}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      // Display fallback only — the form state stays "" when unset so the
                      // field is saved as null ("not configured").
                      value={settingsForm.primaryColor || "#ea580c"}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          primaryColor: e.target.value,
                        }))
                      }
                      className="h-10 w-14 cursor-pointer rounded border border-gray-300"
                    />
                    <input
                      type="text"
                      value={settingsForm.primaryColor}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          primaryColor: e.target.value,
                        }))
                      }
                      className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-mono text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  {fieldErrors.primaryColor && (
                    <p className="mt-1 text-xs text-red-600">
                      {fieldErrors.primaryColor}
                    </p>
                  )}
                </div>

                {/* REQ-086: Organization description */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("description")}
                  </label>
                  <textarea
                    value={settingsForm.description}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    rows={3}
                    className="w-full resize-none rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {t("descriptionHint")}
                  </p>
                </div>

                {/* REQ-086: Public website toggle */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("publicSiteEnabled")}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="publicSiteEnabled"
                      checked={settingsForm.publicSiteEnabled}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          publicSiteEnabled: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                    />
                    <label
                      htmlFor="publicSiteEnabled"
                      className="text-sm font-medium text-gray-700"
                    >
                      {settingsForm.publicSiteEnabled
                        ? t("publicSiteEnabledOn")
                        : t("publicSiteEnabledOff")}
                    </label>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {t("publicSiteEnabledHint")}
                  </p>
                </div>

                {/* REQ-086: Logo upload */}
                <div>
                  <label
                    htmlFor="logoUpload"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    {t("logo")}
                  </label>
                  <input
                    id="logoUpload"
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    onChange={handleLogoFileChange}
                    className="block w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-orange-600 file:px-4 file:py-2 file:font-medium file:text-white hover:file:bg-orange-700"
                  />
                  <p className="mt-1 text-xs text-gray-500">{t("logoHint")}</p>
                  {logoFile && (
                    <p className="mt-1 text-xs text-gray-700">
                      {logoFile.name}
                    </p>
                  )}
                  {logoUploadState === "uploading" && (
                    <p className="mt-1 text-xs text-gray-500">
                      {t("logoUploading")}
                    </p>
                  )}
                  {logoUploadState === "invalid" && (
                    <p className="mt-1 text-xs text-red-600">
                      {t("logoInvalid")}
                    </p>
                  )}
                  {logoUploadState === "failed" && (
                    <p className="mt-1 text-xs text-red-600">
                      {t("logoUploadFailed")}
                    </p>
                  )}
                </div>

                {/* ---- Contact information (REQ-086) ---- */}
                <div className="border-t border-gray-200 pt-6">
                  <h2 className="mb-4 text-base font-semibold text-gray-900">
                    {t("sectionContactTitle")}
                  </h2>
                  <div className="space-y-6">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        {t("contactEmail")}
                      </label>
                      <input
                        type="email"
                        value={settingsForm.contactEmail}
                        onChange={(e) =>
                          setSettingsForm((prev) => ({
                            ...prev,
                            contactEmail: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                      />
                      {fieldErrors.contactEmail && (
                        <p className="mt-1 text-xs text-red-600">
                          {fieldErrors.contactEmail}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        {t("contactPhone")}
                      </label>
                      <input
                        type="tel"
                        value={settingsForm.contactPhone}
                        onChange={(e) =>
                          setSettingsForm((prev) => ({
                            ...prev,
                            contactPhone: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        {t("contactAddress")}
                      </label>
                      <textarea
                        value={settingsForm.contactAddress}
                        onChange={(e) =>
                          setSettingsForm((prev) => ({
                            ...prev,
                            contactAddress: e.target.value,
                          }))
                        }
                        rows={2}
                        className="w-full resize-none rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
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
                    {(logoPreviewUrl || settings?.logoUrl) && !logoImgError ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoPreviewUrl ?? settings?.logoUrl ?? ""}
                        alt={settingsForm.applicationName}
                        onError={() => setLogoImgError(true)}
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                        style={{
                          backgroundColor: settingsForm.logoBackgroundColor,
                          color: settingsForm.logoTextColor,
                        }}
                      >
                        {settingsForm.logoText}
                      </div>
                    )}
                    <span
                      className="font-medium"
                      style={{ color: settingsForm.primaryColor }}
                    >
                      {settingsForm.applicationName}
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

        {/* ===================== Modules Tab ===================== */}
        {activeTab === "modules" && (
          <div className="rounded-xl bg-white p-6 shadow-sm">
            {modulesMessage && (
              <div
                className={`mb-6 rounded-lg p-4 text-sm ${
                  modulesMessage.type === "success"
                    ? "border border-green-200 bg-green-50 text-green-800"
                    : "border border-red-200 bg-red-50 text-red-800"
                }`}
              >
                {modulesMessage.text}
              </div>
            )}

            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {t("modulesTitle")}
              </h2>
              <p className="mt-1 text-sm text-gray-600">{t("modulesIntro")}</p>
            </div>

            {/* Self-lockout note (AC-6): Admin + this tab can never be disabled.
                REQ-087 (E10-S2 review patch): neutral orange info styling — no blue in
                authenticated UI (project-context). */}
            <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
              {t("moduleAdminNote")}
            </div>

            {modulesLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-orange-600"></div>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {MODULE_KEYS.map((key) => {
                  const m = modules.find((x) => x.moduleKey === key);
                  const enabled = m?.enabled ?? true;
                  return (
                    <div key={key} className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-gray-900">
                            {t(`modules.${key}.name`)}
                          </p>
                          <p className="mt-0.5 text-sm text-gray-600">
                            {t(`modules.${key}.description`)}
                          </p>
                          <p className="mt-1 text-xs text-gray-400">
                            {m && m.updatedBy
                              ? t("moduleLastChanged", {
                                  date: new Date(
                                    m.updatedAt
                                  ).toLocaleDateString("de-CH", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                  }),
                                  user: m.updatedBy,
                                })
                              : t("moduleNeverChanged")}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span
                            className={`text-sm font-medium ${
                              enabled ? "text-green-700" : "text-gray-500"
                            }`}
                          >
                            {enabled ? t("moduleEnabled") : t("moduleDisabled")}
                          </span>
                          {/* REQ-087 (E10-S2, post-review): toggle switch instead of a
                              bare checkbox — matches the app's orange primary styling. */}
                          <button
                            type="button"
                            role="switch"
                            id={`module-${key}`}
                            aria-checked={enabled}
                            aria-label={t(`modules.${key}.name`)}
                            disabled={
                              moduleSavingKey === key ||
                              moduleConfirmKey === key
                            }
                            onClick={() => handleModuleToggle(key, enabled)}
                            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                              enabled ? "bg-orange-600" : "bg-gray-300"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                enabled ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============== Module Disable Confirmation Modal ============== */}
        {/* REQ-087 (E10-S2, post-review): the disable confirmation + advisory dependency
            warning is now a modal instead of an inline panel. */}
        {moduleConfirmKey && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setModuleConfirmKey(null)}
            />
            <div className="relative mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
              <h3 className="mb-2 text-lg font-semibold text-gray-900">
                {t("moduleDisableTitle")}
              </h3>
              <p className="text-sm text-gray-700">
                {t("moduleDisableConfirm", {
                  module: t(`modules.${moduleConfirmKey}.name`),
                })}
              </p>
              {enabledDependents(moduleConfirmKey).length > 0 && (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {t("moduleDependencyWarning", {
                    dependents: enabledDependents(moduleConfirmKey)
                      .map((dep) => t(`modules.${dep}.name`))
                      .join(", "),
                  })}
                </p>
              )}
              {/* REQ-087 (E10-S2 review patch): a failed save keeps the modal open and
                  surfaces the error here, where the user is acting. */}
              {modulesMessage?.type === "error" && (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {modulesMessage.text}
                </p>
              )}
              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setModuleConfirmKey(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm transition-colors hover:bg-gray-50"
                >
                  {tCommon("cancel")}
                </button>
                <button
                  onClick={() => applyModuleChange(moduleConfirmKey, false)}
                  disabled={moduleSavingKey === moduleConfirmKey}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {moduleSavingKey === moduleConfirmKey
                    ? t("saving")
                    : t("moduleConfirmDisable")}
                </button>
              </div>
            </div>
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
