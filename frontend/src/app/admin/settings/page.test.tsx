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

beforeEach(() => {
  // jsdom has no object-URL support — stub it for the logo preview path.
  global.URL.createObjectURL = vi.fn(() => "blob:mock-logo");
  global.URL.revokeObjectURL = vi.fn();

  apiGet.mockImplementation((endpoint: string) => {
    if (endpoint === "/api/v1/settings") {
      return Promise.resolve({ data: mockSettings, error: null });
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
