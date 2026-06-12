/**
 * Admin-settings feature transport types (E27-S3). There is NO `@/lib/api` module
 * that owns these shapes — the settings god-page declared them inline (DEC-1 = A:
 * the page is already on the `useApiClient` contract, nothing to wrap). They are
 * relocated here verbatim so the slice api/hooks/components share one definition.
 */

// REQ-086 (E9-S1): organization profile & branding — all profile fields nullable.
export interface SystemSettings {
  id: string;
  applicationName: string;
  logoText: string;
  logoBackgroundColor: string;
  logoTextColor: string;
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

// REQ-004: the canonical roles a custom role can be linked to. Kept as a named
// union so the form schema / select / badge all reference the same set (A95).
export type LinkedRole = "Admin" | "Vorstand" | "Member";

export interface CustomRole {
  id: string;
  name: string;
  description: string;
  linkedRole: LinkedRole;
  isActive: boolean;
  color: string;
  sortOrder: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

/**
 * Full edit-mode PUT body (mirrors the god-page `roleForm`). `linkedRole` is a free
 * `string` (NOT the canonical `LinkedRole` union) so an out-of-set stored value
 * round-trips on save — the A95 widening flows through the write path, not just the
 * `<select>`.
 */
export interface UpdateCustomRoleRequest {
  name: string;
  description: string;
  linkedRole: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
}

/** Create-mode POST body — the subset WITHOUT `isActive` (god-page parity). */
export type CreateCustomRoleRequest = Omit<UpdateCustomRoleRequest, "isActive">;

// REQ-087 (E10-S2): per-module enablement state from GET /api/v1/module-settings.
export interface ModuleSetting {
  moduleKey: string;
  enabled: boolean;
  updatedAt: string;
  updatedBy: string | null;
}

// REQ-086 (E9-S1): the branding profile PUT body (blank optional fields → null).
export interface UpdateSettingsRequest {
  applicationName: string;
  logoText: string;
  logoBackgroundColor: string;
  logoTextColor: string;
  description: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactAddress: string | null;
  primaryColor: string | null;
  publicSiteEnabled: boolean;
}
