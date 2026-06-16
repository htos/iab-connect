// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// REQ-086 (E9-S4) AC-1/AC-2/AC-5: the de-branded i18n keys interpolate {organizationName}
// (and {year}) — the consuming components pass the configured org name from
// useAppSettings(), and no raw "{organizationName}" placeholder leaks unrendered.

// next-intl mock that actually performs single-brace interpolation, so a component that
// forgets to pass a param would leave a visible "{organizationName}" — which the tests catch.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) => {
    if (!vars) return key;
    let out = key;
    for (const [k, v] of Object.entries(vars)) {
      out = out.replaceAll(`{${k}}`, String(v));
    }
    // Echo the interpolated values so assertions can see them regardless of the key text.
    return `${out} ${Object.values(vars).join(" ")}`;
  },
}));

vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/navigation/LanguageSwitcher", () => ({
  LanguageSwitcher: () => <div data-testid="lang-switcher" />,
}));

vi.mock("@/features/public/api/public-forms-api", () => ({
  subscribeNewsletter: vi.fn(),
  unsubscribeByEmail: vi.fn(),
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

import PublicFooter from "@/components/navigation/PublicFooter";
import PublicNewsletterPage from "@/app/public/newsletter/page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("i18n branding interpolation (REQ-086 E9-S4)", () => {
  it("PublicFooter feeds organizationName into description + copyright", () => {
    const { container } = render(<PublicFooter />);

    // The configured org name reaches the interpolated keys...
    expect(screen.getAllByText(/Acme Verein/).length).toBeGreaterThan(0);
    // ...and no raw placeholder leaks.
    expect(container.textContent).not.toContain("{organizationName}");
    expect(container.textContent).not.toContain("{year}");
  });

  it("newsletter subscribe page feeds organizationName into the description", () => {
    const { container } = render(<PublicNewsletterPage />);

    expect(screen.getAllByText(/Acme Verein/).length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain("{organizationName}");
  });
});
