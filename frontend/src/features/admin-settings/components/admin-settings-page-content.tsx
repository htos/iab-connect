"use client";

/**
 * Admin Settings page content (E27-S3 feature-slice migration of
 * `app/admin/settings/page.tsx`). REQ-004 / REQ-086 (E9) / REQ-087 (E10).
 *
 * The composition root rendered by the thin `app/admin/settings/page.tsx` entry; the
 * only `"use client"` boundary for the settings surface. The THREE tabs
 * (branding / customRoles / modules), the auth guard (`router.push("/")` + `return
 * null`), the back-link/header/tabs shell, and the persistent (non-dismissing) per-tab
 * banners are preserved verbatim (pinned by the E27-S1 net).
 *
 * It embeds its OWN `QueryClientProvider` so the slice's TanStack hooks work when the
 * page is mounted in isolation (the E27-S1 oracle renders `<SettingsPage />` directly,
 * with no app-level provider) — a feature-local composition-root concern, distinct
 * from the global `app/providers.tsx` client (which still wraps it in the running app;
 * nested providers are fine, the nearest wins).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PageShell } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { useSettings } from "../hooks/use-settings";
import {
  LogoUploadError,
  useUpdateSettings,
} from "../hooks/use-update-settings";
import { useCustomRoles } from "../hooks/use-custom-roles";
import {
  useCreateRole,
  useDeleteRole,
  useUpdateRole,
} from "../hooks/use-role-mutations";
import { useModules, useUpdateModule } from "../hooks/use-modules";
import { BrandingSettingsForm } from "./branding-settings-form";
import { CustomRolesTab } from "./custom-roles-tab";
import { CustomRoleForm } from "./custom-role-form";
import { ModulesTab } from "./modules-tab";
import type { BrandingSettingsValues } from "../schemas/admin-settings.schema";
import type { CustomRoleValues } from "../schemas/custom-role.schema";
import type {
  CustomRole,
  SystemSettings,
  UpdateSettingsRequest,
} from "../types/admin-settings.types";

type Tab = "branding" | "customRoles" | "modules";

type Banner = { type: "success" | "error"; text: string } | null;

// REQ-086 (E9-S1): map the loaded settings into the editable branding form shape.
// Nullable profile fields map to "" (an untouched blank field is sent back as null on
// save so it stays "not configured"). Verbatim from the god-page `mapSettingsToForm`.
function mapSettingsToForm(data: SystemSettings): BrandingSettingsValues {
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

function AdminSettingsBody() {
  const t = useTranslations("settings");
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, isAdmin } = useAuth();
  const enabled = isAuthenticated && isAdmin;

  const [activeTab, setActiveTab] = useState<Tab>("branding");

  // --- Auth redirect (verbatim: target is "/", NOT "/login") ---
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  // --- Queries (one GET per surface on mount, gated on the admin guard) ---
  const settingsQuery = useSettings(enabled);
  const rolesQuery = useCustomRoles(enabled);
  const modulesQuery = useModules(enabled);

  // --- Branding state ---
  const updateSettings = useUpdateSettings();
  const [settingsBanner, setSettingsBanner] = useState<Banner>(null);
  const [logoFailed, setLogoFailed] = useState(false);

  // --- Custom roles state ---
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();
  const [rolesBanner, setRolesBanner] = useState<Banner>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // --- Modules state ---
  const updateModule = useUpdateModule();
  const [modulesBanner, setModulesBanner] = useState<Banner>(null);
  const [moduleSavingKey, setModuleSavingKey] = useState<string | null>(null);
  const [moduleConfirmKey, setModuleConfirmKey] = useState<string | null>(null);

  // The persistent load-error banner derives from the query error (god-page parity).
  const settingsMessage: Banner = settingsQuery.isError
    ? { type: "error", text: t("loadError") }
    : settingsBanner;
  const rolesMessage: Banner = rolesQuery.isError
    ? { type: "error", text: t("rolesLoadError") }
    : rolesBanner;
  const modulesMessage: Banner = modulesQuery.isError
    ? { type: "error", text: t("modulesLoadError") }
    : modulesBanner;

  // --- Branding save (PUT + optional logo POST + refreshAppSettings) ---
  const handleSaveSettings = (
    body: UpdateSettingsRequest,
    logoFile: File | null
  ) => {
    setSettingsBanner(null);
    setLogoFailed(false);
    updateSettings.mutate(
      { body, logoFile },
      {
        onSuccess: () => {
          setSettingsBanner({ type: "success", text: t("saveSuccess") });
        },
        onError: (err) => {
          if (err instanceof LogoUploadError) {
            setLogoFailed(true);
            setSettingsBanner({ type: "error", text: t("logoUploadFailed") });
          } else {
            setSettingsBanner({ type: "error", text: t("saveError") });
          }
        },
      }
    );
  };

  // --- Role CRUD ---
  const openNewRoleModal = () => {
    setEditingRole(null);
    setShowRoleModal(true);
  };
  const openEditRoleModal = (role: CustomRole) => {
    setEditingRole(role);
    setShowRoleModal(true);
  };

  const handleSaveRole = (values: CustomRoleValues) => {
    setRolesBanner(null);
    if (editingRole) {
      updateRole.mutate(
        {
          id: editingRole.id,
          body: {
            name: values.name,
            description: values.description,
            linkedRole: values.linkedRole,
            color: values.color,
            sortOrder: values.sortOrder,
            isActive: values.isActive,
          },
        },
        {
          onSuccess: () => {
            setRolesBanner({ type: "success", text: t("roleUpdateSuccess") });
            setShowRoleModal(false);
          },
          onError: () =>
            setRolesBanner({ type: "error", text: t("roleError") }),
        }
      );
    } else {
      // Create POSTs the subset WITHOUT isActive (god-page parity).
      createRole.mutate(
        {
          name: values.name,
          description: values.description,
          linkedRole: values.linkedRole,
          color: values.color,
          sortOrder: values.sortOrder,
        },
        {
          onSuccess: () => {
            setRolesBanner({ type: "success", text: t("roleCreateSuccess") });
            setShowRoleModal(false);
          },
          onError: () =>
            setRolesBanner({ type: "error", text: t("roleError") }),
        }
      );
    }
  };

  const handleDeleteRole = (id: string) => {
    setRolesBanner(null);
    deleteRole.mutate(id, {
      onSuccess: () =>
        setRolesBanner({ type: "success", text: t("roleDeleteSuccess") }),
      onError: () => setRolesBanner({ type: "error", text: t("roleError") }),
    });
    setDeleteConfirmId(null);
  };

  // --- Module enable/disable ---
  const applyModuleChange = (moduleKey: string, nextEnabled: boolean) => {
    setModuleSavingKey(moduleKey);
    setModulesBanner(null);
    updateModule.mutate(
      { moduleKey, enabled: nextEnabled },
      {
        onSuccess: () => {
          setModulesBanner({ type: "success", text: t("moduleSaveSuccess") });
          setModuleSavingKey(null);
          setModuleConfirmKey(null);
        },
        onError: () => {
          // Keep the confirm modal open so the error shows where the user is acting.
          setModulesBanner({ type: "error", text: t("moduleSaveError") });
          setModuleSavingKey(null);
        },
      }
    );
  };

  const handleModuleToggle = (moduleKey: string, currentlyEnabled: boolean) => {
    if (currentlyEnabled) {
      setModuleConfirmKey(moduleKey);
    } else {
      applyModuleChange(moduleKey, true);
    }
  };

  // --- Loading / auth guard ---
  if (authLoading) {
    return (
      <PageShell maxWidth="5xl">
        <div className="flex min-h-100 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
        </div>
      </PageShell>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  const brandingDefaults = settingsQuery.data
    ? mapSettingsToForm(settingsQuery.data)
    : null;

  return (
    <PageShell maxWidth="5xl">
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
      {activeTab === "branding" &&
        (settingsQuery.isLoading || !brandingDefaults ? (
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
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-orange-600"></div>
            </div>
          </div>
        ) : (
          <BrandingSettingsForm
            key={settingsQuery.dataUpdatedAt}
            defaultValues={brandingDefaults}
            currentLogoUrl={settingsQuery.data?.logoUrl ?? null}
            onSubmit={handleSaveSettings}
            pending={updateSettings.isPending}
            message={settingsMessage}
            logoFailed={logoFailed}
          />
        ))}

      {/* ===================== Custom Roles Tab ===================== */}
      {activeTab === "customRoles" && (
        <CustomRolesTab
          roles={rolesQuery.data ?? []}
          loading={rolesQuery.isLoading}
          message={rolesMessage}
          deleteConfirmId={deleteConfirmId}
          onNewRole={openNewRoleModal}
          onEditRole={openEditRoleModal}
          onArmDelete={setDeleteConfirmId}
          onCancelDelete={() => setDeleteConfirmId(null)}
          onConfirmDelete={handleDeleteRole}
        />
      )}

      {/* ===================== Modules Tab ===================== */}
      {activeTab === "modules" && (
        <ModulesTab
          modules={modulesQuery.data ?? []}
          loading={modulesQuery.isLoading}
          message={modulesMessage}
          savingKey={moduleSavingKey}
          confirmKey={moduleConfirmKey}
          onToggle={handleModuleToggle}
          onConfirmDisable={(key) => applyModuleChange(key, false)}
          onCancelConfirm={() => setModuleConfirmKey(null)}
        />
      )}

      {/* ===================== Role Modal ===================== */}
      {showRoleModal && (
        <CustomRoleForm
          mode={editingRole ? "edit" : "create"}
          defaultValues={
            editingRole
              ? {
                  name: editingRole.name,
                  description: editingRole.description,
                  linkedRole: editingRole.linkedRole,
                  color: editingRole.color,
                  sortOrder: editingRole.sortOrder,
                  isActive: editingRole.isActive,
                }
              : {
                  name: "",
                  description: "",
                  linkedRole: "Member",
                  color: "#ea580c",
                  sortOrder: rolesQuery.data?.length ?? 0,
                  isActive: true,
                }
          }
          onSubmit={handleSaveRole}
          onCancel={() => setShowRoleModal(false)}
          pending={createRole.isPending || updateRole.isPending}
        />
      )}

      {/* Delete confirmation a11y live region (god-page parity) */}
      {deleteConfirmId && (
        <div className="sr-only" aria-live="assertive">
          {t("deleteRoleConfirm")}
        </div>
      )}
    </PageShell>
  );
}

export function AdminSettingsPageContent() {
  // Feature-local QueryClient so the slice hooks work when the page is rendered in
  // isolation (E27-S1 oracle). Stable across re-renders via lazy useState init.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // god-page parity: the manual loaders did NOT retry, so disable retries (also
        // keeps the E27-S1 error-banner assertions fast + deterministic). The global
        // app client (app/providers.tsx) still wraps this in production.
        defaultOptions: {
          queries: { staleTime: 60 * 1000, retry: false },
        },
      })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <AdminSettingsBody />
    </QueryClientProvider>
  );
}
