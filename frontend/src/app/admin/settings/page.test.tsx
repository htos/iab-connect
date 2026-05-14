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

// next/navigation: stubbed router
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
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
const apiUpload = vi.fn();
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    isAdmin: true,
  }),
  useApiClient: () => ({
    get: apiGet,
    put: apiPut,
    post: vi.fn(),
    delete: vi.fn(),
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

    const toggles = container.querySelectorAll('input[type="checkbox"]');
    // 7 module rows — each row has exactly one checkbox.
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
