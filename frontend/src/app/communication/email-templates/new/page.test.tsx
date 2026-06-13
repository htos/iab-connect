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
 * E25-S1: Characterization tests for the NEW Email-Template page.
 *
 * Pins the CURRENT observable behaviour of
 * `frontend/src/app/communication/email-templates/new/page.tsx` BEFORE the
 * Communication feature-slice refactor. TEST-ONLY — no production code changes.
 *
 * HEAD quirks pinned here:
 *   - authLoading → spinner.
 *   - guard `!isAuthenticated || (!isAdmin && !isVorstand)` → SILENT `return null`
 *     (NOT a router redirect — distinct from the index page).
 *   - authorized → renders EmailTemplateForm; on save calls
 *     `createTemplate(data, accessToken)` → success banner → ~1.5s redirect to
 *     /communication/email-templates.
 *
 * Conventions match `src/app/board/documents/page.test.tsx`. The real
 * EmailTemplateForm (manual useState + TipTap RichTextEditor) is rendered — its
 * required name/subject inputs are filled before submit to drive a real save.
 */

// next-intl: stable identity translator; ignores the namespace, returns the key.
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
  accessToken: "tok-123" as string | undefined,
  isLoading: false,
  isAuthenticated: true,
  isAdmin: false,
  isVorstand: true,
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

import NewEmailTemplatePage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  authState.accessToken = "tok-123";
  authState.isLoading = false;
  authState.isAuthenticated = true;
  authState.isAdmin = false;
  authState.isVorstand = true;
  createTemplate.mockResolvedValue({ id: 99 });
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
      <NewEmailTemplatePage />
    </QueryClientProvider>
  );
}

describe("NewEmailTemplatePage — characterization (current behaviour)", () => {
  it("shows the spinner while auth is loading (no redirect)", () => {
    authState.isLoading = true;

    const { container } = renderPage();

    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  // --- silent-null guard (NOT a redirect) ---

  it("renders nothing (silent null) for an unauthenticated user and does not redirect", () => {
    authState.isAuthenticated = false;
    authState.isAdmin = false;
    authState.isVorstand = false;

    const { container } = renderPage();

    expect(container).toBeEmptyDOMElement();
    expect(push).not.toHaveBeenCalled();
  });

  it("renders nothing (silent null) for an authenticated Member-only user and does not redirect", () => {
    authState.isAuthenticated = true;
    authState.isAdmin = false;
    authState.isVorstand = false;

    const { container } = renderPage();

    expect(container).toBeEmptyDOMElement();
    expect(push).not.toHaveBeenCalled();
  });

  // --- authorized → form renders ---

  it("renders the EmailTemplateForm for an Admin", () => {
    authState.isAdmin = true;
    authState.isVorstand = false;

    renderPage();

    // form save button (common.save key)
    expect(screen.getByRole("button", { name: "save" })).toBeInTheDocument();
    expect(screen.getByText("newTitle")).toBeInTheDocument();
  });

  it("renders the EmailTemplateForm for a Vorstand", () => {
    renderPage();

    expect(screen.getByRole("button", { name: "save" })).toBeInTheDocument();
  });

  // --- save → createTemplate(data, accessToken) → success → redirect ---

  it("on submit calls createTemplate(data, accessToken), shows success, then redirects", async () => {
    renderPage();

    // fill the form's required fields (name + subject)
    fireEvent.change(screen.getByPlaceholderText("namePlaceholder"), {
      target: { value: "My Template" },
    });
    fireEvent.change(screen.getByPlaceholderText("subjectPlaceholder"), {
      target: { value: "My Subject" },
    });

    fireEvent.click(screen.getByRole("button", { name: "save" }));

    await waitFor(() => expect(createTemplate).toHaveBeenCalledTimes(1));
    const [data, token] = createTemplate.mock.calls[0];
    expect(token).toBe("tok-123");
    expect(data).toMatchObject({ name: "My Template", subject: "My Subject" });

    // success banner (emailTemplates.form.createSuccess key)
    expect(await screen.findByText("form.createSuccess")).toBeInTheDocument();

    // ~1.5s delayed redirect
    await waitFor(
      () => expect(push).toHaveBeenCalledWith("/communication/email-templates"),
      { timeout: 2500 }
    );
  });

  it("surfaces the error message when createTemplate rejects (no redirect)", async () => {
    createTemplate.mockRejectedValue(new Error("create boom"));

    renderPage();

    fireEvent.change(screen.getByPlaceholderText("namePlaceholder"), {
      target: { value: "X" },
    });
    fireEvent.change(screen.getByPlaceholderText("subjectPlaceholder"), {
      target: { value: "Y" },
    });
    fireEvent.click(screen.getByRole("button", { name: "save" }));

    expect(await screen.findByText("create boom")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
