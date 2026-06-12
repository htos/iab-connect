// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Patch 2 (auth-gate regression): the detail + edit content gated the
 * `useAutomation` query `enabled` on the ROLE (`isVorstand || isAdmin`). The
 * god-pages gated the fetch on the TOKEN ONLY, so a non-privileged authed user
 * direct-navving got a backend 403 → the lib fn throws → the red `loadError`
 * panel. The role-gated `enabled=false` never ran the query → no data, no error
 * → a PERMANENT loading spinner. The fix gates the fetch on `isAuthenticated &&
 * !!accessToken`; these tests pin that a non-privileged authed user whose fetch
 * rejects sees the error surface, NOT a perpetual spinner.
 */

const auth = vi.hoisted(() => ({
  // Authenticated but NON-privileged (the bug scenario).
  isAuthenticated: true,
  isLoading: false,
  isVorstand: false,
  isAdmin: false,
  accessToken: "tok",
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => auth }));

vi.mock("next-intl", () => {
  const translate = (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key;
  return { useTranslations: () => translate };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const getAutomation = vi.fn();
const getExecutions = vi.fn().mockResolvedValue([]);
vi.mock("@/lib/api/automations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/automations")>(
    "@/lib/api/automations"
  );
  return {
    ...actual,
    getAutomation: (...a: unknown[]) => getAutomation(...a),
    getExecutions: (...a: unknown[]) => getExecutions(...a),
  };
});

vi.mock("@/lib/email-templates", () => ({
  emailTemplatesApi: {
    getAllTemplates: vi.fn().mockResolvedValue([]),
  },
}));

import { AutomationDetail } from "./automation-detail";
import { AutomationEditContent } from "./automation-edit-content";

function renderWith(node: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>
  );
}

beforeEach(() => {
  getAutomation.mockReset();
  getExecutions.mockResolvedValue([]);
});

afterEach(cleanup);

describe("auth-gate (non-privileged authed user, fetch 403)", () => {
  it("detail renders the loadError panel — not a perpetual spinner", async () => {
    // Backend 403 → wrapped lib fn throws.
    getAutomation.mockRejectedValue(new Error("Forbidden"));

    const { container } = renderWith(<AutomationDetail id="abc" />);

    // The query MUST run (token-gated) and surface the error panel.
    expect(await screen.findByText("loadError")).toBeInTheDocument();
    await waitFor(() =>
      expect(container.querySelector(".animate-spin")).not.toBeInTheDocument()
    );
    expect(getAutomation).toHaveBeenCalledWith("tok", "abc");
  });

  it("edit content renders the loadError panel — not a perpetual spinner", async () => {
    getAutomation.mockRejectedValue(new Error("Forbidden"));

    const { container } = renderWith(<AutomationEditContent id="abc" />);

    expect(await screen.findByText("loadError")).toBeInTheDocument();
    await waitFor(() =>
      expect(container.querySelector(".animate-spin")).not.toBeInTheDocument()
    );
    expect(getAutomation).toHaveBeenCalledWith("tok", "abc");
  });
});
