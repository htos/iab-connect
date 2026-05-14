// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// REQ-086 (E9-S2) AC-1/AC-2: the unauthenticated home page hero renders the
// configured organization, not a hardcoded "IAB" / "IAB Connect".

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isLoading: false,
    user: null,
    roles: [],
    isAdmin: false,
    isVorstand: false,
    isMember: false,
    canReadFinance: false,
  }),
  useApiClient: () => ({ get: vi.fn() }),
}));

vi.mock("@/components/OnboardingBanner", () => ({
  OnboardingBanner: () => null,
}));

const customSettings = {
  applicationName: "Acme Verein",
  logoText: "AV",
  logoBackgroundColor: "#123456",
  logoTextColor: "#abcdef",
  description: "desc",
  primaryColor: "#123456",
  publicSiteEnabled: true,
  logoUrl: null,
};
vi.mock("@/components/providers/AppSettingsProvider", () => ({
  useAppSettings: () => ({ settings: customSettings, isLoading: false }),
}));

import HomePage from "./page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("HomePage hero branding (REQ-086 E9-S2)", () => {
  it("renders the configured org name + logo text for guests", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", { name: "Acme Verein" })
    ).toBeInTheDocument();
    expect(screen.getByText("AV")).toBeInTheDocument();
    expect(screen.queryByText("IAB Connect")).not.toBeInTheDocument();
    expect(screen.queryByText("IAB")).not.toBeInTheDocument();
  });
});
