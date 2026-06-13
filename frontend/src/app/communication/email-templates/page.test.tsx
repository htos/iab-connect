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
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * E25-S1: Characterization tests for the Email-Templates LIST page.
 *
 * Pins the CURRENT observable behaviour of
 * `frontend/src/app/communication/email-templates/page.tsx` BEFORE the
 * Communication feature-slice refactor. TEST-ONLY — no production code changes.
 *
 * HEAD quirks pinned here:
 *   - The list has NO redirect guard. It reads only `useAuth().accessToken`.
 *     Initial `loading=true`; the load effect early-returns when `!accessToken`
 *     so `getAllTemplates` is NOT called and the spinner stays shown.
 *   - DELETE (A76 load-bearing branch): a destructive/RED affordance
 *     (`text-red-600`). `handleDelete` → native `confirm(...)`; on confirm →
 *     `deleteTemplate(id, accessToken)` → SUCCESS removes the row via
 *     `templates.filter(...)`; FAILURE leaves the list unchanged + sets the
 *     error banner. confirm-cancel skips the delete entirely.
 *
 * Conventions match `src/app/board/documents/page.test.tsx`:
 *   - mutable `authState` (vi.mock @/lib/auth), reset per beforeEach.
 *   - identity translator that ignores the namespace (TWO namespaces used here:
 *     `emailTemplates` + `common`).
 *   - module-level vi.fn() transport, fresh QueryClientProvider per render.
 *   - vi.stubGlobal("confirm", ...) + vi.unstubAllGlobals() in afterEach.
 *   - assert via i18n KEYS, ARIA roles, service-fn call ARGS — never display copy.
 *   - EmailTemplate.id is a NUMBER (numeric ids in fixtures + call args).
 */

// next-intl: stable identity translator; ignores the namespace, returns the key.
vi.mock("next-intl", () => {
  const translate = (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key;
  return { useTranslations: () => translate };
});

// @/lib/auth: configurable, STABLE auth state.
const authState: { accessToken: string | undefined } = {
  accessToken: "tok-123",
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
}));

// Transport: module-level vi.fn()s the slice refactor will re-point.
const getAllTemplates = vi.fn();
const deleteTemplate = vi.fn();
const getTemplateById = vi.fn();
const createTemplate = vi.fn();
const updateTemplate = vi.fn();
vi.mock("@/features/communication/email-templates/api/email-templates", () => ({
  emailTemplatesApi: {
    getAllTemplates: (...a: unknown[]) => getAllTemplates(...a),
    deleteTemplate: (...a: unknown[]) => deleteTemplate(...a),
    getTemplateById: (...a: unknown[]) => getTemplateById(...a),
    createTemplate: (...a: unknown[]) => createTemplate(...a),
    updateTemplate: (...a: unknown[]) => updateTemplate(...a),
  },
}));

import EmailTemplatesPage from "./page";

function makeTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: "Welcome Email",
    subject: "Welcome aboard",
    htmlContent: "<p>Hi</p>",
    textContent: "Hi",
    // category deliberately distinct from name so name-vs-badge assertions stay unambiguous
    category: "WelcomeCat",
    description: "Greeting for new members",
    version: 1,
    isActive: true,
    variables: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.accessToken = "tok-123";
  getAllTemplates.mockResolvedValue([makeTemplate()]);
  deleteTemplate.mockResolvedValue(undefined);
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true)
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
      <EmailTemplatesPage />
    </QueryClientProvider>
  );
}

describe("EmailTemplatesPage (list) — characterization (current behaviour)", () => {
  // --- no redirect guard: token gating only ---

  it("with NO token shows the loading spinner and never calls getAllTemplates", async () => {
    authState.accessToken = undefined;

    const { container } = renderPage();

    // Initial loading=true; the effect early-returns without a token.
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    expect(screen.getByText("loading")).toBeInTheDocument();
    // Give any (non-existent) effect a tick — still no load.
    await Promise.resolve();
    expect(getAllTemplates).not.toHaveBeenCalled();
  });

  it("with a token loads via getAllTemplates(accessToken) then renders the card grid", async () => {
    renderPage();

    await waitFor(() =>
      expect(getAllTemplates).toHaveBeenCalledWith("tok-123")
    );
    expect(await screen.findByText("Welcome Email")).toBeInTheDocument();
    expect(screen.getByText("Greeting for new members")).toBeInTheDocument();
  });

  // --- badges ---

  it("renders the category badge (verbatim, not via i18n) for each template", async () => {
    renderPage();
    await screen.findByText("Welcome Email");

    // category value rendered verbatim (the identity translator is not applied)
    expect(screen.getByText("WelcomeCat")).toBeInTheDocument();
  });

  it("renders the inactive badge only when isActive is false", async () => {
    getAllTemplates.mockResolvedValue([
      makeTemplate({ id: 7, name: "Archived", isActive: false }),
    ]);

    renderPage();
    await screen.findByText("Archived");

    expect(screen.getByText("inactive")).toBeInTheDocument();
  });

  it("does NOT render the inactive badge when isActive is true", async () => {
    renderPage();
    await screen.findByText("Welcome Email");

    expect(screen.queryByText("inactive")).not.toBeInTheDocument();
  });

  // --- client search ---

  it("filters the grid client-side by name/description (case-insensitive)", async () => {
    getAllTemplates.mockResolvedValue([
      makeTemplate({ id: 1, name: "Welcome", description: "greeting" }),
      makeTemplate({ id: 2, name: "Payment", description: "invoice due" }),
    ]);

    renderPage();
    await screen.findByText("Welcome");

    fireEvent.change(screen.getByPlaceholderText("searchPlaceholder"), {
      target: { value: "pay" },
    });

    expect(screen.queryByText("Welcome")).not.toBeInTheDocument();
    expect(screen.getByText("Payment")).toBeInTheDocument();
  });

  it("shows the empty state (with searchResults copy) when search matches nothing", async () => {
    renderPage();
    await screen.findByText("Welcome Email");

    fireEvent.change(screen.getByPlaceholderText("searchPlaceholder"), {
      target: { value: "zzz-no-match" },
    });

    expect(screen.getByText("noTemplates")).toBeInTheDocument();
    expect(screen.getByText("noSearchResults")).toBeInTheDocument();
  });

  it("shows the empty state with the create-first CTA when no templates exist", async () => {
    getAllTemplates.mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText("noTemplates")).toBeInTheDocument();
    expect(screen.getByText("noTemplatesDescription")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "createFirstTemplate" })
    ).toBeInTheDocument();
  });

  // --- edit link href (numeric id) ---

  it("renders an edit link to /communication/email-templates/{id}", async () => {
    renderPage();
    await screen.findByText("Welcome Email");

    expect(screen.getByRole("link", { name: "edit" })).toHaveAttribute(
      "href",
      "/communication/email-templates/1"
    );
  });

  // --- DELETE: destructive affordance ---

  it("renders the delete button with the destructive (red) affordance", async () => {
    renderPage();
    await screen.findByText("Welcome Email");

    const deleteButton = screen.getByRole("button", { name: "delete" });
    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton.className).toContain("text-red-600");
  });

  // --- DELETE: confirm-cancel path ---

  it("does NOT call deleteTemplate when the confirm is cancelled", async () => {
    vi.stubGlobal(
      "confirm",
      vi.fn(() => false)
    );

    renderPage();
    await screen.findByText("Welcome Email");

    fireEvent.click(screen.getByRole("button", { name: "delete" }));

    expect(deleteTemplate).not.toHaveBeenCalled();
    // row unchanged
    expect(screen.getByText("Welcome Email")).toBeInTheDocument();
  });

  // --- DELETE: success branch (row removed) ---
  // A79 mechanism delta: the manual `templates.filter(...)` became a TanStack
  // mutation that invalidates the list, so removal is observed via the REFETCH
  // returning a list without the deleted row (the OUTCOME is unchanged: the item is
  // gone after a successful delete). The transport mock is unchanged (A94) — only
  // the post-delete refetch resolves to an empty list.

  it("on confirm calls deleteTemplate(id, accessToken) and removes the row on success", async () => {
    renderPage();
    await screen.findByText("Welcome Email");

    // After the successful delete, the invalidated list refetch returns no rows.
    getAllTemplates.mockResolvedValue([]);

    fireEvent.click(screen.getByRole("button", { name: "delete" }));

    await waitFor(() =>
      expect(deleteTemplate).toHaveBeenCalledWith(1, "tok-123")
    );
    await waitFor(() =>
      expect(screen.queryByText("Welcome Email")).not.toBeInTheDocument()
    );
  });

  // --- DELETE: failure branch (row unchanged + error banner) ---

  it("on delete FAILURE keeps the row and surfaces the deleteError banner", async () => {
    deleteTemplate.mockRejectedValue(new Error("nope"));

    renderPage();
    await screen.findByText("Welcome Email");

    fireEvent.click(screen.getByRole("button", { name: "delete" }));

    await waitFor(() => expect(deleteTemplate).toHaveBeenCalled());
    // err is an Error → message "nope" surfaced (not the deleteError fallback key)
    expect(await screen.findByText("nope")).toBeInTheDocument();
    // row remains
    expect(screen.getByText("Welcome Email")).toBeInTheDocument();
  });
});
