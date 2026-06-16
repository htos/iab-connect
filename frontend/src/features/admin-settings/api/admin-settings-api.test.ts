// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * E27-S3: the admin-settings slice api owns the query-key factory and ENCAPSULATES
 * the transport on the `useApiClient` contract (DEC-1 = A — the god-page was already
 * on it; nothing to wrap). These pin the key shapes and assert each function calls the
 * right api-client method with a BYTE-IDENTICAL endpoint / body (verified against the
 * god-page), including the logo upload (FormData field `"file"`) and the create subset
 * (no `isActive`).
 */

import {
  SETTINGS_BASE,
  SETTINGS_LOGO,
  CUSTOM_ROLES_BASE,
  MODULE_SETTINGS_BASE,
  adminSettingsKeys,
  getSettings,
  updateSettings,
  uploadLogo,
  getCustomRoles,
  createCustomRole,
  updateCustomRole,
  deleteCustomRole,
  getModules,
  updateModule,
} from "./admin-settings-api";
import type {
  CreateCustomRoleRequest,
  UpdateCustomRoleRequest,
  UpdateSettingsRequest,
} from "../types/admin-settings.types";

function makeApi() {
  return {
    get: vi.fn(() => Promise.resolve({ data: null, error: null, status: 200 })),
    post: vi.fn(() =>
      Promise.resolve({ data: null, error: null, status: 200 })
    ),
    put: vi.fn(() => Promise.resolve({ data: null, error: null, status: 200 })),
    delete: vi.fn(() =>
      Promise.resolve({ data: null, error: null, status: 200 })
    ),
    upload: vi.fn(() =>
      Promise.resolve({ data: null, error: null, status: 200 })
    ),
  };
}

type Api = ReturnType<typeof makeApi>;

afterEach(() => vi.clearAllMocks());

describe("adminSettingsKeys", () => {
  it("exposes the three stable key shapes", () => {
    expect(adminSettingsKeys.settings).toEqual(["admin-settings", "settings"]);
    expect(adminSettingsKeys.customRoles).toEqual([
      "admin-settings",
      "custom-roles",
    ]);
    expect(adminSettingsKeys.modules).toEqual(["admin-settings", "modules"]);
  });
});

describe("branding settings endpoints (byte-identical to the god-page)", () => {
  it("getSettings GETs /api/v1/settings", () => {
    const api = makeApi() as unknown as Api;
    getSettings(api);
    expect(api.get).toHaveBeenCalledWith(SETTINGS_BASE);
    expect(SETTINGS_BASE).toBe("/api/v1/settings");
  });

  it("updateSettings PUTs /api/v1/settings with the body", () => {
    const api = makeApi() as unknown as Api;
    const body: UpdateSettingsRequest = {
      applicationName: "Acme",
      logoText: "AV",
      logoBackgroundColor: "#123456",
      logoTextColor: "#ffffff",
      description: null,
      contactEmail: null,
      contactPhone: null,
      contactAddress: null,
      primaryColor: null,
      publicSiteEnabled: true,
    };
    updateSettings(api, body);
    expect(api.put).toHaveBeenCalledWith(SETTINGS_BASE, body);
  });

  it("uploadLogo POSTs /api/v1/settings/logo with FormData carrying field 'file'", () => {
    const api = makeApi() as unknown as Api;
    const file = new File(["x"], "logo.png", { type: "image/png" });
    uploadLogo(api, file);
    expect(api.upload).toHaveBeenCalledTimes(1);
    const [endpoint, formData] = api.upload.mock.calls[0] as unknown as [
      string,
      FormData,
    ];
    expect(endpoint).toBe(SETTINGS_LOGO);
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get("file")).toBe(file);
  });
});

describe("custom-roles endpoints (byte-identical to the god-page)", () => {
  it("getCustomRoles GETs /api/v1/custom-roles", () => {
    const api = makeApi() as unknown as Api;
    getCustomRoles(api);
    expect(api.get).toHaveBeenCalledWith(CUSTOM_ROLES_BASE);
  });

  it("createCustomRole POSTs the base with the create subset (no isActive)", () => {
    const api = makeApi() as unknown as Api;
    const body: CreateCustomRoleRequest = {
      name: "New Role",
      description: "",
      linkedRole: "Member",
      color: "#ea580c",
      sortOrder: 0,
    };
    createCustomRole(api, body);
    expect(api.post).toHaveBeenCalledWith(CUSTOM_ROLES_BASE, body);
    expect(body).not.toHaveProperty("isActive");
  });

  it("updateCustomRole PUTs /custom-roles/:id with the full form", () => {
    const api = makeApi() as unknown as Api;
    const body: UpdateCustomRoleRequest = {
      name: "Edited",
      description: "",
      linkedRole: "Admin",
      color: "#ff0000",
      sortOrder: 1,
      isActive: true,
    };
    updateCustomRole(api, "r1", body);
    expect(api.put).toHaveBeenCalledWith(`${CUSTOM_ROLES_BASE}/r1`, body);
  });

  it("deleteCustomRole DELETEs /custom-roles/:id", () => {
    const api = makeApi() as unknown as Api;
    deleteCustomRole(api, "r1");
    expect(api.delete).toHaveBeenCalledWith(`${CUSTOM_ROLES_BASE}/r1`);
  });
});

describe("module-settings endpoints (byte-identical to the god-page)", () => {
  it("getModules GETs /api/v1/module-settings", () => {
    const api = makeApi() as unknown as Api;
    getModules(api);
    expect(api.get).toHaveBeenCalledWith(MODULE_SETTINGS_BASE);
  });

  it("updateModule PUTs /module-settings/:key with { enabled }", () => {
    const api = makeApi() as unknown as Api;
    updateModule(api, "finance", false);
    expect(api.put).toHaveBeenCalledWith(`${MODULE_SETTINGS_BASE}/finance`, {
      enabled: false,
    });
  });
});
