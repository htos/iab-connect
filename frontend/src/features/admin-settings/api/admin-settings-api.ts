// Admin-settings feature API (E27-S3). DEC-1 = A BUILD: the settings god-page was
// ALREADY on the E21-S1 DEC-1 client contract — it issued every request via
// `useApiClient()` ({ data, error, status }, never throws). There is NO token-param
// `settings.ts` to wrap (A94 N/A). So this layer simply ENCAPSULATES the
// five endpoint families behind named functions on that same client; URLs / bodies
// are BYTE-IDENTICAL to the god-page (verified line-by-line). No raw `/api/v1/...`
// string lives in any component (E21-S1 rule 5).
import type { useApiClient } from "@/lib/auth";
import type {
  CreateCustomRoleRequest,
  CustomRole,
  ModuleSetting,
  SystemSettings,
  UpdateCustomRoleRequest,
  UpdateSettingsRequest,
} from "../types/admin-settings.types";

type AdminSettingsApiClient = ReturnType<typeof useApiClient>;

export const SETTINGS_BASE = "/api/v1/settings";
export const SETTINGS_LOGO = "/api/v1/settings/logo";
export const CUSTOM_ROLES_BASE = "/api/v1/custom-roles";
export const MODULE_SETTINGS_BASE = "/api/v1/module-settings";

/**
 * Query-key + invalidation convention (E21-S1 server-state strategy). Three
 * independent server surfaces (branding settings / custom roles / module
 * settings), each a single un-paginated GET, so each gets one stable key a
 * mutation can invalidate exactly (A79).
 */
export const adminSettingsKeys = {
  settings: ["admin-settings", "settings"] as const,
  customRoles: ["admin-settings", "custom-roles"] as const,
  modules: ["admin-settings", "modules"] as const,
};

// --- Branding settings (E9 / REQ-086) ---

/** GET the system settings (branding + organization profile). */
export function getSettings(api: AdminSettingsApiClient) {
  return api.get<SystemSettings>(SETTINGS_BASE);
}

/** PUT the branding profile. Body byte-identical to the god-page (blanks → null). */
export function updateSettings(
  api: AdminSettingsApiClient,
  body: UpdateSettingsRequest
) {
  return api.put<SystemSettings>(SETTINGS_BASE, body);
}

/**
 * Upload the logo as a SECOND request after the profile PUT. `api.upload` POSTs a
 * multipart FormData with the field name `"file"` (the god-page contract).
 */
export function uploadLogo(api: AdminSettingsApiClient, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return api.upload<{ logoUrl: string }>(SETTINGS_LOGO, formData);
}

// --- Custom roles (REQ-004) ---

/** GET all custom roles. */
export function getCustomRoles(api: AdminSettingsApiClient) {
  return api.get<CustomRole[]>(CUSTOM_ROLES_BASE);
}

/** POST a new role — the create subset WITHOUT `isActive` (god-page parity). */
export function createCustomRole(
  api: AdminSettingsApiClient,
  body: CreateCustomRoleRequest
) {
  return api.post<CustomRole>(CUSTOM_ROLES_BASE, body);
}

/** PUT the full form to an existing role. */
export function updateCustomRole(
  api: AdminSettingsApiClient,
  id: string,
  body: UpdateCustomRoleRequest
) {
  return api.put<CustomRole>(`${CUSTOM_ROLES_BASE}/${id}`, body);
}

/** DELETE a role by id. */
export function deleteCustomRole(api: AdminSettingsApiClient, id: string) {
  return api.delete<void>(`${CUSTOM_ROLES_BASE}/${id}`);
}

// --- Module settings (E10 / REQ-087) ---

/** GET all module-enablement rows. */
export function getModules(api: AdminSettingsApiClient) {
  return api.get<ModuleSetting[]>(MODULE_SETTINGS_BASE);
}

/** PUT a single module's enabled flag: `/module-settings/{key}` `{ enabled }`. */
export function updateModule(
  api: AdminSettingsApiClient,
  moduleKey: string,
  enabled: boolean
) {
  return api.put<ModuleSetting>(`${MODULE_SETTINGS_BASE}/${moduleKey}`, {
    enabled,
  });
}
