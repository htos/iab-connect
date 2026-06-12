// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// REQ-086 (E9-S1) AC-7/AC-8/AC-12: Branding tab renders the new organization-profile
// fields, the live preview reflects form values, save calls PUT (+ logo POST when a
// file is staged), and logo upload error states surface inline.

// next-intl: identity translations
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// next/navigation: stubbed router with a shared `push` spy (E27-S1 redirect assertion).
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));

// next/link: passthrough
vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const refreshAppSettings = vi.fn();
vi.mock("@/components/providers/AppSettingsProvider", () => ({
  useAppSettings: () => ({ refresh: refreshAppSettings }),
}));

const apiGet = vi.fn();
const apiPut = vi.fn();
const apiPost = vi.fn();
const apiDelete = vi.fn();
const apiUpload = vi.fn();
// E27-S1 (AC-3): mutable auth state so the admin-redirect test can flip it per-test.
// Defaults to an authenticated admin (the prior fixed shape) so every pre-existing test
// stays green; afterEach resets it back to the admin defaults.
const authState = {
  isAuthenticated: true,
  isLoading: false,
  isAdmin: true,
};
const push = vi.fn();
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => ({
    get: apiGet,
    put: apiPut,
    post: apiPost,
    delete: apiDelete,
    upload: apiUpload,
  }),
}));

import SettingsPage from "./page";

const mockSettings = {
  id: "11111111-1111-1111-1111-111111111111",
  applicationName: "Acme Verein",
  logoText: "AV",
  logoBackgroundColor: "#123456",
  logoTextColor: "#ffffff",
  description: "An association",
  contactEmail: "info@acme.example",
  contactPhone: "+41 11 222 33 44",
  contactAddress: "Main Street 1",
  primaryColor: "#abcdef",
  publicSiteEnabled: true,
  logoUrl: null,
  updatedAt: "2026-05-14T00:00:00Z",
  updatedBy: "admin",
};

// REQ-087 (E10-S2): all 7 modules enabled — finance + events both on so the
// Finance<->Events dependency warning has something to render.
const mockModules = [
  "members",
  "events",
  "documents",
  "communication",
  "finance",
  "partners",
  "public_view",
].map((moduleKey) => ({
  moduleKey,
  enabled: true,
  updatedAt: "2026-05-14T00:00:00Z",
  updatedBy: moduleKey === "events" ? "admin" : null,
}));

beforeEach(() => {
  // jsdom has no object-URL support — stub it for the logo preview path.
  global.URL.createObjectURL = vi.fn(() => "blob:mock-logo");
  global.URL.revokeObjectURL = vi.fn();

  apiGet.mockImplementation((endpoint: string) => {
    if (endpoint === "/api/v1/settings") {
      return Promise.resolve({ data: mockSettings, error: null });
    }
    if (endpoint === "/api/v1/module-settings") {
      return Promise.resolve({ data: mockModules, error: null });
    }
    return Promise.resolve({ data: [], error: null });
  });
  apiPut.mockResolvedValue({ data: mockSettings, error: null });
  apiUpload.mockResolvedValue({
    data: { logoUrl: "/api/v1/settings/logo" },
    error: null,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  // Reset the mutable auth state back to the authenticated-admin default.
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.isAdmin = true;
});

describe("Branding tab (REQ-086 E9-S1)", () => {
  it("renders the new organization-profile fields", async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("description")).toBeInTheDocument();
    });
    expect(screen.getByText("contactEmail")).toBeInTheDocument();
    expect(screen.getByText("contactPhone")).toBeInTheDocument();
    expect(screen.getByText("contactAddress")).toBeInTheDocument();
    expect(screen.getByText("primaryColor")).toBeInTheDocument();
    expect(screen.getByText("publicSiteEnabled")).toBeInTheDocument();
    expect(screen.getByText("logo")).toBeInTheDocument();
  });

  it("live preview reflects the loaded application name", async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("Acme Verein")).toBeInTheDocument();
    });
  });

  it("save calls PUT /api/v1/settings", async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("saveSettings")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("saveSettings"));

    await waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith(
        "/api/v1/settings",
        expect.objectContaining({ applicationName: "Acme Verein" })
      );
    });
  });

  it("save also POSTs the logo when a file is staged", async () => {
    const { container } = render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("saveSettings")).toBeInTheDocument();
    });

    const fileInput = container.querySelector(
      "#logoUpload"
    ) as HTMLInputElement;
    const file = new File(["x"], "logo.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByText("saveSettings"));

    await waitFor(() => {
      expect(apiUpload).toHaveBeenCalledWith(
        "/api/v1/settings/logo",
        expect.any(FormData)
      );
    });
  });

  it("rejects an invalid logo file type inline", async () => {
    const { container } = render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("logo")).toBeInTheDocument();
    });

    const fileInput = container.querySelector(
      "#logoUpload"
    ) as HTMLInputElement;
    const bad = new File(["x"], "logo.txt", { type: "text/plain" });
    fireEvent.change(fileInput, { target: { files: [bad] } });

    expect(screen.getByText("logoInvalid")).toBeInTheDocument();
  });

  it("surfaces a failed logo upload", async () => {
    apiUpload.mockResolvedValue({ data: null, error: "boom" });
    const { container } = render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("saveSettings")).toBeInTheDocument();
    });

    const fileInput = container.querySelector(
      "#logoUpload"
    ) as HTMLInputElement;
    const file = new File(["x"], "logo.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByText("saveSettings"));

    // Surfaced both in the inline logo sub-state and the page-level error banner.
    await waitFor(() => {
      expect(screen.getAllByText("logoUploadFailed").length).toBeGreaterThan(0);
    });
  });
});

describe("Modules tab (REQ-087 E10-S2)", () => {
  async function openModulesTab(container: HTMLElement) {
    await waitFor(() => {
      expect(screen.getByText("tabModules")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("tabModules"));
    // Wait for the module rows (loaded from GET /api/v1/module-settings) to render.
    await waitFor(() => {
      expect(container.querySelector("#module-finance")).toBeInTheDocument();
    });
  }

  it("renders one labelled toggle per module (7 modules)", async () => {
    const { container } = render(<SettingsPage />);
    await openModulesTab(container);

    // REQ-087 (E10-S2, post-review): each row has a switch-role toggle button.
    const toggles = container.querySelectorAll('button[role="switch"]');
    expect(toggles.length).toBe(7);
    expect(container.querySelector("#module-members")).toBeInTheDocument();
    expect(container.querySelector("#module-public_view")).toBeInTheDocument();
  });

  it("disabling a module shows a confirmation before applying", async () => {
    const { container } = render(<SettingsPage />);
    await openModulesTab(container);

    fireEvent.click(container.querySelector("#module-documents")!);

    // Confirmation copy appears; no PUT yet.
    expect(screen.getByText("moduleDisableConfirm")).toBeInTheDocument();
    expect(apiPut).not.toHaveBeenCalled();
  });

  it("shows the Finance<->Events dependency warning when disabling Finance", async () => {
    const { container } = render(<SettingsPage />);
    await openModulesTab(container);

    fireEvent.click(container.querySelector("#module-finance")!);

    expect(screen.getByText("moduleDependencyWarning")).toBeInTheDocument();
  });

  it("confirming a disable calls PUT and refreshes app settings", async () => {
    const { container } = render(<SettingsPage />);
    await openModulesTab(container);

    fireEvent.click(container.querySelector("#module-finance")!);
    fireEvent.click(screen.getByText("moduleConfirmDisable"));

    await waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith("/api/v1/module-settings/finance", {
        enabled: false,
      });
    });
    expect(refreshAppSettings).toHaveBeenCalled();
  });

  it("fetches module settings exactly once on mount (no duplicate GET)", async () => {
    const { container } = render(<SettingsPage />);
    await openModulesTab(container);

    const moduleGets = apiGet.mock.calls.filter(
      (c) => c[0] === "/api/v1/module-settings"
    );
    expect(moduleGets.length).toBe(1);
  });

  it("keeps the confirmation modal open and shows the error on a failed save", async () => {
    apiPut.mockResolvedValue({ data: null, error: "boom" });
    const { container } = render(<SettingsPage />);
    await openModulesTab(container);

    fireEvent.click(container.querySelector("#module-finance")!);
    fireEvent.click(screen.getByText("moduleConfirmDisable"));

    await waitFor(() => {
      expect(apiPut).toHaveBeenCalled();
    });
    // Modal stays open (confirm copy still present) and the error surfaces in it.
    expect(screen.getByText("moduleDisableConfirm")).toBeInTheDocument();
    expect(screen.getAllByText("moduleSaveError").length).toBeGreaterThan(0);
  });

  it("enabling a disabled module applies immediately without confirmation", async () => {
    apiGet.mockImplementation((endpoint: string) => {
      if (endpoint === "/api/v1/settings") {
        return Promise.resolve({ data: mockSettings, error: null });
      }
      if (endpoint === "/api/v1/module-settings") {
        return Promise.resolve({
          data: mockModules.map((m) =>
            m.moduleKey === "partners" ? { ...m, enabled: false } : m
          ),
          error: null,
        });
      }
      return Promise.resolve({ data: [], error: null });
    });
    const { container } = render(<SettingsPage />);
    await openModulesTab(container);

    fireEvent.click(container.querySelector("#module-partners")!);

    await waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith("/api/v1/module-settings/partners", {
        enabled: true,
      });
    });
    // Enabling is non-destructive — no confirmation dialog.
    expect(screen.queryByText("moduleDisableConfirm")).not.toBeInTheDocument();
  });
});

// ============================================================================
// E27-S1 (REQ-004) AC-3 — added characterization coverage
// ============================================================================

// Two custom roles spanning the linked-role badge colours (Admin=red, Member=green).
const mockRoles = [
  {
    id: "role-admin-1",
    name: "Super Admin",
    description: "Full access",
    linkedRole: "Admin" as const,
    isActive: true,
    color: "#ff0000",
    sortOrder: 0,
    createdAt: "2026-05-14T00:00:00Z",
    createdBy: "admin",
    updatedAt: "2026-05-14T00:00:00Z",
    updatedBy: "admin",
  },
  {
    id: "role-member-2",
    name: "Junior Member",
    description: "Limited access",
    linkedRole: "Member" as const,
    isActive: false,
    color: "#00ff00",
    sortOrder: 1,
    createdAt: "2026-05-14T00:00:00Z",
    createdBy: "admin",
    updatedAt: "2026-05-14T00:00:00Z",
    updatedBy: "admin",
  },
];

// apiGet implementation that also serves /api/v1/custom-roles with the role fixture.
function mockGetWithRoles() {
  apiGet.mockImplementation((endpoint: string) => {
    if (endpoint === "/api/v1/settings") {
      return Promise.resolve({ data: mockSettings, error: null });
    }
    if (endpoint === "/api/v1/module-settings") {
      return Promise.resolve({ data: mockModules, error: null });
    }
    if (endpoint === "/api/v1/custom-roles") {
      return Promise.resolve({ data: mockRoles, error: null });
    }
    return Promise.resolve({ data: [], error: null });
  });
}

describe("Admin auth guard (E27-S1 AC-3)", () => {
  it("redirects a non-admin to / (target is /, not /login)", async () => {
    authState.isAdmin = false;
    const { container } = render(<SettingsPage />);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/");
    });
    // Non-admin guard returns null — no tabs render.
    expect(screen.queryByText("tabBranding")).not.toBeInTheDocument();
    expect(container.querySelector(".mx-auto")).toBeNull();
  });

  it("redirects an unauthenticated user to /", async () => {
    authState.isAuthenticated = false;
    render(<SettingsPage />);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/");
    });
  });
});

describe("Custom Roles tab (E27-S1 AC-3 / REQ-004)", () => {
  async function openRolesTab() {
    await waitFor(() => {
      expect(screen.getByText("tabCustomRoles")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("tabCustomRoles"));
  }

  it("lists roles loaded from GET /api/v1/custom-roles", async () => {
    mockGetWithRoles();
    render(<SettingsPage />);
    await openRolesTab();

    await waitFor(() => {
      expect(screen.getByText("Super Admin")).toBeInTheDocument();
    });
    expect(screen.getByText("Junior Member")).toBeInTheDocument();
    expect(apiGet.mock.calls.some((c) => c[0] === "/api/v1/custom-roles")).toBe(
      true
    );
  });

  it("renders linked-role badge colours (Admin=red, Member=green)", async () => {
    mockGetWithRoles();
    render(<SettingsPage />);
    await openRolesTab();

    await waitFor(() => {
      expect(screen.getByText("Super Admin")).toBeInTheDocument();
    });
    // Badge text is the literal linkedRole value (not translated).
    const adminBadge = screen.getByText("Admin");
    expect(adminBadge.className).toContain("bg-red-100");
    expect(adminBadge.className).toContain("text-red-800");
    const memberBadge = screen.getByText("Member");
    expect(memberBadge.className).toContain("bg-green-100");
    expect(memberBadge.className).toContain("text-green-800");
  });

  it("creating a role POSTs a subset (no isActive) to /api/v1/custom-roles", async () => {
    mockGetWithRoles();
    apiPost.mockResolvedValue({ data: mockRoles[0], error: null });
    render(<SettingsPage />);
    await openRolesTab();

    await waitFor(() => {
      expect(screen.getByText("newRole")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("newRole"));

    // Modal opens with the create title; fill the required name then submit.
    // Title + submit button both use the createRole key, so expect >= 1 match.
    await waitFor(() => {
      expect(screen.getAllByText("createRole").length).toBeGreaterThan(0);
    });
    const nameInput = screen.getAllByRole("textbox")[0] as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "New Role" } });

    // The submit button label equals "createRole" (same key as the title) — it's the
    // last matching node (title comes first in DOM order).
    const createButtons = screen.getAllByText("createRole");
    fireEvent.click(createButtons[createButtons.length - 1]);

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/custom-roles",
        expect.objectContaining({
          name: "New Role",
          linkedRole: "Member",
        })
      );
    });
    // POST payload is a subset — it must NOT carry isActive.
    const payload = apiPost.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("isActive");
  });

  it("editing a role PUTs the full form to /api/v1/custom-roles/:id", async () => {
    mockGetWithRoles();
    apiPut.mockResolvedValue({ data: mockRoles[0], error: null });
    render(<SettingsPage />);
    await openRolesTab();

    await waitFor(() => {
      expect(screen.getByText("Super Admin")).toBeInTheDocument();
    });
    // Open the edit modal for the first role via its edit button (title=editRole).
    const editButtons = screen.getAllByTitle("editRole");
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      // Modal heading uses the editRole key.
      expect(screen.getAllByText("editRole").length).toBeGreaterThan(0);
    });
    // Submit the edit (button label is editRole when editing).
    const editLabels = screen.getAllByText("editRole");
    fireEvent.click(editLabels[editLabels.length - 1]);

    await waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith(
        "/api/v1/custom-roles/role-admin-1",
        expect.objectContaining({
          name: "Super Admin",
          linkedRole: "Admin",
          isActive: true,
          color: "#ff0000",
          sortOrder: 0,
        })
      );
    });
  });

  it("inline delete-confirm then DELETE /api/v1/custom-roles/:id", async () => {
    mockGetWithRoles();
    apiDelete.mockResolvedValue({ data: null, error: null });
    render(<SettingsPage />);
    await openRolesTab();

    await waitFor(() => {
      expect(screen.getByText("Super Admin")).toBeInTheDocument();
    });
    // First click on the row's delete icon arms the inline confirm; no DELETE yet.
    const deleteIcons = screen.getAllByTitle("deleteRole");
    fireEvent.click(deleteIcons[0]);
    expect(apiDelete).not.toHaveBeenCalled();

    // The inline confirm renders a labelled "deleteRole" button — click it.
    const confirmButton = screen.getByText("deleteRole");
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalledWith(
        "/api/v1/custom-roles/role-admin-1"
      );
    });
  });

  it("shows the rolesLoadError banner when the roles GET fails", async () => {
    apiGet.mockImplementation((endpoint: string) => {
      if (endpoint === "/api/v1/settings") {
        return Promise.resolve({ data: mockSettings, error: null });
      }
      if (endpoint === "/api/v1/module-settings") {
        return Promise.resolve({ data: mockModules, error: null });
      }
      if (endpoint === "/api/v1/custom-roles") {
        return Promise.resolve({ data: null, error: "boom" });
      }
      return Promise.resolve({ data: [], error: null });
    });
    render(<SettingsPage />);
    await openRolesTab();

    await waitFor(() => {
      expect(screen.getByText("rolesLoadError")).toBeInTheDocument();
    });
  });
});

describe("Settings load/save errors + persistent banners (E27-S1 AC-3)", () => {
  it("shows loadError when the settings GET fails", async () => {
    apiGet.mockImplementation((endpoint: string) => {
      if (endpoint === "/api/v1/settings") {
        return Promise.resolve({ data: null, error: "boom" });
      }
      if (endpoint === "/api/v1/module-settings") {
        return Promise.resolve({ data: mockModules, error: null });
      }
      return Promise.resolve({ data: [], error: null });
    });
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("loadError")).toBeInTheDocument();
    });
  });

  it("shows saveError when the settings PUT fails", async () => {
    apiPut.mockResolvedValue({ data: null, error: "boom" });
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("saveSettings")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("saveSettings"));

    await waitFor(() => {
      expect(screen.getByText("saveError")).toBeInTheDocument();
    });
  });

  it("a successful branding save calls refreshAppSettings()", async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("saveSettings")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("saveSettings"));

    await waitFor(() => {
      expect(refreshAppSettings).toHaveBeenCalled();
    });
    // Success banner present.
    expect(screen.getByText("saveSuccess")).toBeInTheDocument();
  });

  it("success banner is persistent — no auto-dismiss timer", async () => {
    vi.useFakeTimers();
    try {
      render(<SettingsPage />);

      // Resolve the initial loads under fake timers.
      await vi.waitFor(() => {
        expect(screen.getByText("saveSettings")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("saveSettings"));
      await vi.waitFor(() => {
        expect(screen.getByText("saveSuccess")).toBeInTheDocument();
      });

      // Advance well past any plausible auto-dismiss window — banner must remain.
      vi.advanceTimersByTime(60_000);
      expect(screen.getByText("saveSuccess")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
