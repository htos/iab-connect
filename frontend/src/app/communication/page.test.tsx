// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * E25-S1: Characterization tests for the Communication INDEX page.
 *
 * Pins the CURRENT observable behaviour of
 * `frontend/src/app/communication/page.tsx` BEFORE the Communication
 * feature-slice refactor. TEST-ONLY — no production code changes.
 *
 * HEAD quirks pinned here:
 *   - isLoading → spinner.
 *   - guard `!isAuthenticated || (!isAdmin && !isVorstand)` → `router.push("/")`
 *     (in a useEffect) AND `return null` (DISTINCT from the new/[id] pages'
 *     silent-null — the index DOES redirect).
 *   - authorized → 3 nav <Link>s (email-campaigns / email-templates /
 *     automations) + 2 quick-action <Link>s (email-campaigns/new,
 *     email-templates/new). Assert the hrefs.
 *
 * Conventions match `src/app/board/documents/page.test.tsx`. Single namespace
 * here (`communication`); the identity translator returns the key regardless.
 */

// next-intl: stable identity translator; returns the key.
vi.mock("next-intl", () => {
  const translate = (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key;
  return { useTranslations: () => translate };
});

// next/navigation: stable router so push() is assertable.
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));

// @/lib/auth: configurable, STABLE auth state.
const authState = {
  isAuthenticated: true,
  isLoading: false,
  isAdmin: false,
  isVorstand: true,
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
}));

import CommunicationPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.isAdmin = false;
  authState.isVorstand = true;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CommunicationPage />
    </QueryClientProvider>
  );
}

describe("CommunicationPage (index) — characterization (current behaviour)", () => {
  it("shows the spinner while auth is loading and does not redirect", () => {
    authState.isLoading = true;

    const { container } = renderPage();

    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  // --- redirect guard (DISTINCT from new/[id] silent-null) ---

  it("redirects an unauthenticated user to / and renders nothing", async () => {
    authState.isAuthenticated = false;
    authState.isAdmin = false;
    authState.isVorstand = false;

    const { container } = renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(container).toBeEmptyDOMElement();
  });

  it("redirects an authenticated Member-only user to / and renders nothing", async () => {
    authState.isAuthenticated = true;
    authState.isAdmin = false;
    authState.isVorstand = false;

    const { container } = renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(container).toBeEmptyDOMElement();
  });

  // --- authorized → nav cards + quick actions ---

  it("renders the 3 nav cards with their hrefs for a Vorstand", () => {
    renderPage();

    expect(
      screen.getByRole("link", { name: /emailCampaigns\.title/ })
    ).toHaveAttribute("href", "/communication/email-campaigns");
    expect(
      screen.getByRole("link", { name: /emailTemplates\.title/ })
    ).toHaveAttribute("href", "/communication/email-templates");
    expect(
      screen.getByRole("link", { name: /automations\.title/ })
    ).toHaveAttribute("href", "/communication/automations");
    expect(push).not.toHaveBeenCalled();
  });

  it("renders the 3 nav cards for an Admin", () => {
    authState.isAdmin = true;
    authState.isVorstand = false;

    renderPage();

    expect(
      screen.getByRole("link", { name: /emailCampaigns\.title/ })
    ).toHaveAttribute("href", "/communication/email-campaigns");
    expect(
      screen.getByRole("link", { name: /emailTemplates\.title/ })
    ).toHaveAttribute("href", "/communication/email-templates");
    expect(
      screen.getByRole("link", { name: /automations\.title/ })
    ).toHaveAttribute("href", "/communication/automations");
  });

  it("renders the 2 quick-action links with their hrefs", () => {
    renderPage();

    expect(
      screen.getByRole("link", { name: "quickActions.newCampaign" })
    ).toHaveAttribute("href", "/communication/email-campaigns/new");
    expect(
      screen.getByRole("link", { name: "quickActions.newTemplate" })
    ).toHaveAttribute("href", "/communication/email-templates/new");
  });
});
