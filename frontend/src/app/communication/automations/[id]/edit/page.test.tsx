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
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * E25-S1: Characterization tests for the EDIT automation page
 * (src/app/communication/automations/[id]/edit/page.tsx) BEFORE the feature-
 * slice refactor. The page reads its id via React 19 `use(params)`, loads the
 * automation via getAutomation, shows a spinner while loading and an error
 * panel on load failure, then renders <AutomationForm mode="edit" initial=…>.
 *
 * HEAD quirks pinned:
 *  - id comes from use(params) (Promise), same as the detail page — uses the
 *    sync-`use` shim + syncThenable helper.
 *  - getAutomation(token, id) is called on mount; loadError panel on rejection.
 *  - Initial values pre-populate the form (name input value).
 *  - submit → updateAutomation(token, initial.id, body) → push("/communication/
 *    automations/{result.id}").
 */

// React 19 `use(promise)` — resolve synchronously (mirrors the detail-page test).
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof React>("react");
  return {
    ...actual,
    use: (input: unknown) => {
      const thenable = input as { then?: (cb: (v: unknown) => void) => void };
      if (thenable && typeof thenable.then === "function") {
        let resolved: unknown;
        thenable.then((v) => (resolved = v));
        return resolved;
      }
      return (actual.use as unknown as (x: unknown) => unknown)(input);
    },
  };
});

function syncThenable<T>(value: T): Promise<T> {
  return { then: (cb: (v: T) => void) => cb(value) } as unknown as Promise<T>;
}

const push = vi.fn();

vi.mock("next-intl", () => {
  const translate = (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key;
  return { useTranslations: () => translate };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    isAdmin: false,
    isVorstand: true,
    accessToken: "test-token",
  }),
}));

vi.mock("@/features/communication/email-templates/api/email-templates", () => ({
  emailTemplatesApi: {
    getAllTemplates: vi
      .fn()
      .mockResolvedValue([{ id: 1, name: "Welcome template" }]),
  },
}));

const getAutomation = vi.fn();
const updateAutomation = vi.fn();
const previewRecipients = vi.fn();
vi.mock("@/features/communication/automations/api/automations", async () => {
  const actual = await vi.importActual<typeof import("@/features/communication/automations/api/automations")>(
    "@/features/communication/automations/api/automations"
  );
  return {
    ...actual,
    getAutomation: (...args: unknown[]) => getAutomation(...args),
    updateAutomation: (...args: unknown[]) => updateAutomation(...args),
    previewRecipients: (...args: unknown[]) => previewRecipients(...args),
  };
});

import EditAutomationPage from "./page";

function detail(overrides: Record<string, unknown> = {}) {
  return {
    id: "abc",
    name: "Welcome journey",
    description: null,
    status: "Draft",
    trigger: { type: "MemberJoined", offsetDays: null },
    templateId: 1,
    templateName: "Welcome template",
    segmentType: "AllActiveMembers",
    segmentFilter: null,
    consentFilter: null,
    createdById: "u",
    createdByName: "tester",
    createdAt: "2026-06-06T10:00:00Z",
    updatedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getAutomation.mockResolvedValue(detail());
  updateAutomation.mockResolvedValue({ id: "abc" });
  previewRecipients.mockResolvedValue({ totalCount: 0, preview: [] });
  // segment-load raw fetch used by AutomationForm.
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ items: [] }) })
    )
  );
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
      <EditAutomationPage params={syncThenable({ id: "abc" })} />
    </QueryClientProvider>
  );
}

describe("EditAutomationPage — characterization (current behaviour)", () => {
  it("loads the automation via getAutomation(token, id) from use(params)", async () => {
    renderPage();

    await waitFor(() => expect(getAutomation).toHaveBeenCalled());
    expect(getAutomation).toHaveBeenCalledWith("test-token", "abc");
  });

  it("shows the spinner while the automation is loading", () => {
    getAutomation.mockReturnValue(new Promise(() => {}));

    const { container } = renderPage();

    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders the edit form (editTitle) pre-populated with the loaded values", async () => {
    renderPage();

    expect(await screen.findByText("editTitle")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        (screen.getByLabelText("form.name") as HTMLInputElement).value
      ).toBe("Welcome journey")
    );
  });

  it("shows the loadError panel when getAutomation rejects", async () => {
    getAutomation.mockRejectedValue(new Error("boom"));

    renderPage();

    expect(await screen.findByText("loadError")).toBeInTheDocument();
    expect(screen.queryByText("editTitle")).not.toBeInTheDocument();
  });

  it("submits via updateAutomation(token, id, body) and redirects to the detail page", async () => {
    renderPage();
    await screen.findByText("editTitle");
    await waitFor(() =>
      expect(
        (screen.getByLabelText("form.name") as HTMLInputElement).value
      ).toBe("Welcome journey")
    );

    fireEvent.change(screen.getByLabelText("form.name"), {
      target: { value: "Welcome journey v2" },
    });
    fireEvent.click(screen.getByText("save"));

    await waitFor(() => expect(updateAutomation).toHaveBeenCalledTimes(1));
    expect(updateAutomation.mock.calls[0][0]).toBe("test-token");
    expect(updateAutomation.mock.calls[0][1]).toBe("abc");
    const body = updateAutomation.mock.calls[0][2] as Record<string, unknown>;
    expect(body.name).toBe("Welcome journey v2");

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/communication/automations/abc")
    );
  });

  it("surfaces an error banner when updateAutomation throws and does not navigate", async () => {
    updateAutomation.mockRejectedValue(new Error("Conflict"));

    renderPage();
    await screen.findByText("editTitle");

    fireEvent.click(screen.getByText("save"));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Conflict");
    expect(push).not.toHaveBeenCalled();
  });
});
