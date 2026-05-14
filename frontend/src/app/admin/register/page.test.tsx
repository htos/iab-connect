// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// REQ-086 (E9-S2) AC-1/AC-2: the registration page logo + footer render the
// configured organization, not "IAB Connect" / "Indischer Kulturverein Bern".

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/api/registration", () => ({
  registerUser: vi.fn(),
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

import RegisterPage from "./page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("RegisterPage branding (REQ-086 E9-S2)", () => {
  it("renders the configured org name + logo text, no hardcoded IAB", () => {
    render(<RegisterPage />);

    expect(screen.getByText("Acme Verein")).toBeInTheDocument();
    expect(screen.getByText("AV")).toBeInTheDocument();
    expect(screen.queryByText("IAB Connect")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Indischer Kulturverein Bern")
    ).not.toBeInTheDocument();
  });

  it("renders the org name in the copyright footer", () => {
    render(<RegisterPage />);

    const year = new Date().getFullYear();
    expect(screen.getByText(`© ${year} Acme Verein`)).toBeInTheDocument();
  });
});
