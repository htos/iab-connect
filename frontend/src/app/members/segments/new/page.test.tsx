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
 * E23-S1: Characterization tests for the NEW Member Segment page (REQ-017).
 *
 * Pins the CURRENT observable behaviour of
 * `frontend/src/app/members/segments/new/page.tsx` BEFORE the E23-S4
 * feature-slice (RHF+Zod) refactor. The observable contract that must survive:
 * the name field renders; a happy-path submit fires `POST /api/v1/member-segments`
 * and redirects to `/members/segments`; a submit error shows the banner and stays
 * on the page; the submit button shows a saving (disabled) state.
 *
 * Sub-harness note (AC-10/A56): segments pages use `useApiClient` from
 * `@/lib/auth` (`{ data, error, status }`); auth is gated on
 * `isAdmin || isVorstand`. Mocks return STABLE references mutated per test.
 */

vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

const push = vi.fn();
const router = { push, replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const apiPost = vi.fn();
const apiClient = {
  get: vi.fn(),
  post: apiPost,
  put: vi.fn(),
  delete: vi.fn(),
  upload: vi.fn(),
};
const authState = {
  isAuthenticated: true,
  isLoading: false,
  isAdmin: true,
  isVorstand: true,
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => apiClient,
}));

import NewSegmentPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.isAdmin = true;
  authState.isVorstand = true;
  apiPost.mockResolvedValue({
    data: { id: "new-1" },
    error: null,
    status: 201,
  });
});

afterEach(cleanup);

// Forward-compat seam (AC-10): wrap in a fresh QueryClientProvider so the S4
// TanStack adopter reuses this spec without harness rework.
function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NewSegmentPage />
    </QueryClientProvider>
  );
}

describe("NewSegmentPage — characterization (current behaviour)", () => {
  it("redirects unauthenticated users to /login", async () => {
    authState.isAuthenticated = false;
    authState.isAdmin = false;
    authState.isVorstand = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });

  it("redirects authenticated non-Vorstand-non-Admin users to /", async () => {
    authState.isAuthenticated = true;
    authState.isAdmin = false;
    authState.isVorstand = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("renders the name and type fields", () => {
    renderPage();

    expect(screen.getByLabelText(/segments\.field\.name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/segments\.field\.type/)).toBeInTheDocument();
  });

  it("submits a new segment via POST /api/v1/member-segments and redirects to /members/segments", async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText(/segments\.field\.name/), {
      target: { value: "New Segment" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "segments.action.create" })
    );

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/member-segments",
        expect.objectContaining({ name: "New Segment" })
      )
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/members/segments"));
  });

  it("shows an error banner and stays on the page when the submit fails", async () => {
    apiPost.mockResolvedValue({
      data: null,
      error: "Create failed",
      status: 400,
    });

    renderPage();

    fireEvent.change(screen.getByLabelText(/segments\.field\.name/), {
      target: { value: "New Segment" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "segments.action.create" })
    );

    expect(await screen.findByText("Create failed")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalledWith("/members/segments");
  });

  it("disables the submit button (showing the saving label) while saving", async () => {
    apiPost.mockReturnValue(new Promise(() => {}));

    renderPage();

    fireEvent.change(screen.getByLabelText(/segments\.field\.name/), {
      target: { value: "New Segment" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "segments.action.create" })
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "common.saving" })
      ).toBeDisabled()
    );
  });
});
