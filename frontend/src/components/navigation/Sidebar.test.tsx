// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// REQ-087 (E10-S4): Sidebar hides a module-tagged nav item when its module is disabled.
// next-intl identity translations so assertions can match on the key id.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@/lib/auth", () => ({
  ROLES: {
    ADMIN: "admin",
    VORSTAND: "vorstand",
    KASSIER: "kassier",
    AUDITOR: "auditor",
    MEMBER: "member",
  },
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    roles: ["admin", "vorstand", "kassier", "member"],
  }),
  useApiClient: () => ({
    get: vi.fn().mockResolvedValue({ error: "skip", data: null }),
  }),
}));

vi.mock("@/components/providers/AppSettingsProvider", () => ({
  useAppSettings: vi.fn(),
}));

vi.mock("./SidebarContext", () => ({
  useSidebar: () => ({ isOpen: true, close: vi.fn() }),
}));

import { Sidebar } from "./Sidebar";
import { useAppSettings } from "@/components/providers/AppSettingsProvider";

const ALL_ENABLED = {
  members: true,
  events: true,
  documents: true,
  communication: true,
  finance: true,
  partners: true,
  public_view: true,
};

function mockModules(modules: Record<string, boolean>) {
  vi.mocked(useAppSettings).mockReturnValue({
    settings: { applicationName: "Test Org", modules },
    isLoading: false,
    refresh: vi.fn(),
  } as never);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Sidebar module filtering", () => {
  it("shows every module nav item when all modules are enabled", () => {
    mockModules(ALL_ENABLED);
    render(<Sidebar />);

    expect(screen.getByText("nav.members")).toBeInTheDocument();
    expect(screen.getByText("nav.events")).toBeInTheDocument();
    expect(screen.getByText("nav.finance")).toBeInTheDocument();
    expect(screen.getByText("nav.partner")).toBeInTheDocument();
  });

  it("hides a nav item whose module is disabled, keeping siblings visible", () => {
    mockModules({ ...ALL_ENABLED, finance: false });
    render(<Sidebar />);

    expect(screen.queryByText("nav.finance")).not.toBeInTheDocument();
    expect(screen.getByText("nav.events")).toBeInTheDocument();
    expect(screen.getByText("nav.members")).toBeInTheDocument();
  });

  it("never gates Dashboard / My Profile / Admin, even with every module disabled", () => {
    mockModules({
      members: false,
      events: false,
      documents: false,
      communication: false,
      finance: false,
      partners: false,
      public_view: false,
    });
    render(<Sidebar />);

    expect(screen.getByText("nav.dashboard")).toBeInTheDocument();
    expect(screen.getByText("nav.myProfile")).toBeInTheDocument();
    expect(screen.getByText("nav.admin")).toBeInTheDocument();
    // ...and a module-tagged item is gone
    expect(screen.queryByText("nav.members")).not.toBeInTheDocument();
  });
});
