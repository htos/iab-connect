// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// REQ-086 (E9-S2) AC-1/AC-2: the public header + footer logo blocks render the
// configured organization from useAppSettings(), not a hardcoded "IAB".

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/navigation/LanguageSwitcher", () => ({
  LanguageSwitcher: () => <div data-testid="lang-switcher" />,
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

import PublicHeader from "./PublicHeader";
import PublicFooter from "./PublicFooter";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PublicHeader / PublicFooter branding (REQ-086 E9-S2)", () => {
  it("PublicHeader renders the configured org name + logo text", () => {
    render(<PublicHeader />);
    expect(screen.getByText("Acme Verein")).toBeInTheDocument();
    expect(screen.getByText("AV")).toBeInTheDocument();
    expect(screen.queryByText("IAB Connect")).not.toBeInTheDocument();
    expect(screen.queryByText("IAB")).not.toBeInTheDocument();
  });

  it("PublicFooter renders the configured org name + logo text", () => {
    render(<PublicFooter />);
    expect(screen.getByText("Acme Verein")).toBeInTheDocument();
    expect(screen.getByText("AV")).toBeInTheDocument();
    expect(screen.queryByText("IAB Connect")).not.toBeInTheDocument();
  });
});
