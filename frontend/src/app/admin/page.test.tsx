// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// E27-S1 (REQ-004) AC-3: characterization net for the static Admin dashboard nav page.
// Pins the 7 admin tiles (label + href), the admin auth-redirect guard (push("/")), and
// the non-admin `return null` behaviour. Pure static page — no fetch.

const push = vi.fn();

// next-intl: identity translations — t(key) => key.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// next/navigation: stubbed router with a shared `push` spy.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));

// next/link: forward href so we can assert tile destinations.
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

// Mutable auth state — flipped per-test for the non-admin guard.
const authState = {
  isAuthenticated: true,
  isLoading: false,
  isAdmin: true,
  accessToken: "test-token",
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => ({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
  }),
}));

import AdminDashboardPage from "./page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isAdmin = true;
  authState.isLoading = false;
});

// The 7 admin sections as rendered by the page (titleKey + href). With identity
// translations the tile heading text is the titleKey verbatim.
const SECTIONS: Array<{ titleKey: string; href: string }> = [
  { titleKey: "users.title", href: "/admin/users" },
  { titleKey: "audit.title", href: "/admin/audit" },
  { titleKey: "register.title", href: "/admin/register" },
  { titleKey: "settings.title", href: "/admin/settings" },
  { titleKey: "backups.title", href: "/admin/backups" },
  { titleKey: "retention.title", href: "/admin/retention" },
  { titleKey: "health.title", href: "/admin/health" },
];

describe("Admin dashboard page (E27-S1 / REQ-004)", () => {
  it("renders the header and subtitle", () => {
    render(<AdminDashboardPage />);
    expect(screen.getByText("title")).toBeInTheDocument();
    expect(screen.getByText("subtitle")).toBeInTheDocument();
  });

  it("renders exactly 7 admin tiles", () => {
    const { container } = render(<AdminDashboardPage />);
    // Each tile is an <a> (next/link passthrough) inside the cards grid.
    const tiles = container.querySelectorAll("a[href^='/admin/']");
    expect(tiles.length).toBe(7);
  });

  it("renders each tile with the correct label and href", () => {
    render(<AdminDashboardPage />);
    for (const { titleKey, href } of SECTIONS) {
      const heading = screen.getByText(titleKey);
      expect(heading).toBeInTheDocument();
      const link = heading.closest("a");
      expect(link).toHaveAttribute("href", href);
    }
  });

  it("renders the quick-info section", () => {
    render(<AdminDashboardPage />);
    expect(screen.getByText("quickInfo.title")).toBeInTheDocument();
    expect(screen.getByText("quickInfo.description")).toBeInTheDocument();
  });

  it("redirects a non-admin to / and renders nothing", () => {
    authState.isAdmin = false;
    const { container } = render(<AdminDashboardPage />);
    expect(push).toHaveBeenCalledWith("/");
    // Non-admin guard returns null — no tiles render.
    expect(container.querySelector("a[href^='/admin/']")).toBeNull();
  });

  it("redirects an unauthenticated user to / and renders nothing", () => {
    authState.isAuthenticated = false;
    const { container } = render(<AdminDashboardPage />);
    expect(push).toHaveBeenCalledWith("/");
    expect(container.querySelector("a[href^='/admin/']")).toBeNull();
  });

  it("does not redirect while auth is still loading", () => {
    authState.isLoading = true;
    authState.isAuthenticated = false;
    authState.isAdmin = false;
    render(<AdminDashboardPage />);
    // Guard waits for isLoading to settle before pushing.
    expect(push).not.toHaveBeenCalled();
  });
});
