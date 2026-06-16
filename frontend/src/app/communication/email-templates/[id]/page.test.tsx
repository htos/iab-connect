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
 * E25-S1: Characterization tests for the EDIT ([id]) Email-Template page.
 *
 * Pins the CURRENT observable behaviour of
 * `frontend/src/app/communication/email-templates/[id]/page.tsx` BEFORE the
 * Communication feature-slice refactor. TEST-ONLY — no production code changes.
 *
 * HEAD quirks pinned here:
 *   - reads the route id via `useParams()` (NOT React `use(params)`); `id =
 *     Number(params.id)` → numeric id in load + save call args.
 *   - authLoading || loading → spinner (loading starts true; the guard's silent
 *     null is reached only after the prefill load resolves).
 *   - guard `!isAuthenticated || (!isAdmin && !isVorstand)` → SILENT `return null`
 *     (NOT a router redirect).
 *   - authorized → loads via `getTemplateById(id, accessToken)`, renders
 *     EmailTemplateForm prefilled; on save calls
 *     `updateTemplate(id, data, accessToken)` → success banner → ~1.5s redirect.
 *
 * Conventions match `src/app/board/documents/page.test.tsx`. The real
 * EmailTemplateForm is rendered (prefill assertable via its input values).
 */

// next-intl: stable identity translator; ignores the namespace, returns the key.
vi.mock("next-intl", () => {
  const translate = (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key;
  return { useTranslations: () => translate };
});

// next/navigation: stable router + useParams (this page reads useParams()).
const push = vi.fn();
const params: { id: string } = { id: "5" };
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  useParams: () => params,
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

import EditEmailTemplatePage from "./page";

function makeTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    name: "Welcome",
    subject: "Welcome aboard",
    htmlContent: "<p>Hi</p>",
    textContent: "Hi",
    category: "Welcome",
    description: "Greeting for new members",
    version: 1,
    isActive: true,
    variables: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  params.id = "5";
  authState.accessToken = "tok-123";
  authState.isLoading = false;
  authState.isAuthenticated = true;
  authState.isAdmin = false;
  authState.isVorstand = true;
  getTemplateById.mockResolvedValue(makeTemplate());
  updateTemplate.mockResolvedValue({ id: 5 });
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
      <EditEmailTemplatePage />
    </QueryClientProvider>
  );
}

describe("EditEmailTemplatePage ([id]) — characterization (current behaviour)", () => {
  it("shows the spinner while auth is loading (no redirect)", () => {
    authState.isLoading = true;

    const { container } = renderPage();

    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("reads the id via useParams as a NUMBER and loads getTemplateById(id, accessToken)", async () => {
    renderPage();

    await waitFor(() =>
      expect(getTemplateById).toHaveBeenCalledWith(5, "tok-123")
    );
  });

  // --- silent-null guard (NOT a redirect) ---

  it("renders nothing (silent null) for a Member-only user after the load resolves; no redirect", async () => {
    authState.isAuthenticated = true;
    authState.isAdmin = false;
    authState.isVorstand = false;

    const { container } = renderPage();

    // loading starts true → wait for the load to settle, then the guard nulls out
    await waitFor(() => expect(getTemplateById).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(push).not.toHaveBeenCalled();
  });

  it("renders nothing (silent null) for an unauthenticated user after the load resolves; no redirect", async () => {
    authState.isAuthenticated = false;
    authState.isAdmin = false;
    authState.isVorstand = false;

    const { container } = renderPage();

    await waitFor(() => expect(getTemplateById).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(push).not.toHaveBeenCalled();
  });

  // --- authorized → prefilled form ---

  it("renders the EmailTemplateForm prefilled from the loaded template", async () => {
    renderPage();

    await waitFor(() => expect(getTemplateById).toHaveBeenCalled());

    const nameInput = (await screen.findByPlaceholderText(
      "namePlaceholder"
    )) as HTMLInputElement;
    const subjectInput = screen.getByPlaceholderText(
      "subjectPlaceholder"
    ) as HTMLInputElement;
    expect(nameInput.value).toBe("Welcome");
    expect(subjectInput.value).toBe("Welcome aboard");
    expect(screen.getByText("editTitle")).toBeInTheDocument();
  });

  // --- save → updateTemplate(id, data, accessToken) → success → redirect ---

  it("on submit calls updateTemplate(id, data, accessToken), shows success, then redirects", async () => {
    renderPage();

    const nameInput = (await screen.findByPlaceholderText(
      "namePlaceholder"
    )) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Welcome v2" } });

    fireEvent.click(screen.getByRole("button", { name: "save" }));

    await waitFor(() => expect(updateTemplate).toHaveBeenCalledTimes(1));
    const [id, data, token] = updateTemplate.mock.calls[0];
    expect(id).toBe(5);
    expect(token).toBe("tok-123");
    expect(data).toMatchObject({ name: "Welcome v2" });

    expect(await screen.findByText("form.saveSuccess")).toBeInTheDocument();

    await waitFor(
      () => expect(push).toHaveBeenCalledWith("/communication/email-templates"),
      { timeout: 2500 }
    );
  });

  it("surfaces the error message when updateTemplate rejects (no redirect)", async () => {
    updateTemplate.mockRejectedValue(new Error("update boom"));

    renderPage();

    await screen.findByPlaceholderText("namePlaceholder");
    fireEvent.click(screen.getByRole("button", { name: "save" }));

    expect(await screen.findByText("update boom")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
