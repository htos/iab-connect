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
 * E22-S1: Characterization tests for the NEW Sponsor page (REQ-031).
 *
 * Pins the CURRENT observable behaviour of `frontend/src/app/sponsors/new/page.tsx`
 * BEFORE the E22-S3 form-slice refactor (which introduces RHF+Zod, DEC-1). The
 * observable contract that must survive: the 9 form fields render; a happy-path
 * submit fires `POST /api/v1/sponsors` and redirects to `/sponsors`; a submit
 * error shows the banner and stays on the page; the submit button shows a saving
 * (disabled) state in flight.
 *
 * NB: the precise required-field VALIDATION TIMING (HTML5 `required` →
 * Zod `required`) is a deliberate A79 delta that E22-S3 changes; this suite pins
 * the happy + error submit paths (the stable contract), not the native-validity
 * mechanism.
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
  isVorstand: false,
  isAdmin: true,
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => apiClient,
}));

import NewSponsorPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.isVorstand = false;
  authState.isAdmin = true;
  apiPost.mockResolvedValue({
    data: { id: "new-1" },
    error: null,
    status: 201,
  });
});

afterEach(cleanup);

// E22-S3 seam: the page now uses TanStack Query (create mutation), so it must
// render inside a QueryClientProvider. Harness change only — the behaviour
// assertions are unchanged.
function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NewSponsorPage />
    </QueryClientProvider>
  );
}

describe("NewSponsorPage — characterization (current behaviour)", () => {
  it("redirects unauthenticated users to /login", async () => {
    authState.isAuthenticated = false;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });

  it("redirects authenticated users who are neither Vorstand nor Admin to /", async () => {
    authState.isAuthenticated = true;
    authState.isVorstand = false;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("renders the company-name and tier fields", () => {
    renderPage();

    expect(screen.getByLabelText(/sponsors\.companyName/)).toBeInTheDocument();
    expect(screen.getByLabelText(/sponsors\.tier/)).toBeInTheDocument();
  });

  it("submits a new sponsor via POST /api/v1/sponsors and redirects to /sponsors", async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText(/sponsors\.companyName/), {
      target: { value: "New Sponsor Inc" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "sponsors.createSponsor" })
    );

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/sponsors",
        expect.objectContaining({
          companyName: "New Sponsor Inc",
          tier: "Bronze",
        })
      )
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/sponsors"));
  });

  it("shows an error banner and stays on the page when the submit fails", async () => {
    apiPost.mockResolvedValue({
      data: null,
      error: "Create failed",
      status: 400,
    });

    renderPage();

    fireEvent.change(screen.getByLabelText(/sponsors\.companyName/), {
      target: { value: "New Sponsor Inc" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "sponsors.createSponsor" })
    );

    expect(await screen.findByText("Create failed")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalledWith("/sponsors");
  });

  it("disables the submit button while saving", async () => {
    apiPost.mockReturnValue(new Promise(() => {})); // never resolves → stays saving

    renderPage();

    fireEvent.change(screen.getByLabelText(/sponsors\.companyName/), {
      target: { value: "New Sponsor Inc" },
    });
    const submit = screen.getByRole("button", {
      name: "sponsors.createSponsor",
    });
    fireEvent.click(submit);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "common.saving" })
      ).toBeDisabled()
    );
  });
});
