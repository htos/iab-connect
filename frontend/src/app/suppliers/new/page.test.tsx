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
 * E22-S4: Characterization tests for the NEW Supplier page (REQ-032).
 *
 * Pins the CURRENT observable behaviour of `frontend/src/app/suppliers/new/page.tsx`
 * BEFORE the E22-S4 form-slice refactor (RHF+Zod — the form sub-recipe established
 * in E22-S3). Admin-only. The observable contract that must survive: the form
 * fields render; a happy-path submit fires `POST /api/v1/suppliers` and redirects
 * to `/suppliers`; a submit error shows the banner; the submit button shows a
 * saving (disabled) state.
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
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => apiClient,
}));

import NewSupplierPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.isAdmin = true;
  apiPost.mockResolvedValue({
    data: { id: "new-1" },
    error: null,
    status: 201,
  });
});

afterEach(cleanup);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NewSupplierPage />
    </QueryClientProvider>
  );
}

describe("NewSupplierPage — characterization (current behaviour)", () => {
  it("redirects unauthenticated users to /login", async () => {
    authState.isAuthenticated = false;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });

  it("redirects authenticated non-admins to /", async () => {
    authState.isAuthenticated = true;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("renders the company-name and category fields", () => {
    renderPage();

    expect(screen.getByLabelText(/suppliers\.companyName/)).toBeInTheDocument();
    expect(screen.getByLabelText(/suppliers\.category/)).toBeInTheDocument();
  });

  it("submits a new supplier via POST /api/v1/suppliers and redirects to /suppliers", async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText(/suppliers\.companyName/), {
      target: { value: "New Supplier Inc" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "suppliers.createSupplier" })
    );

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/suppliers",
        expect.objectContaining({ companyName: "New Supplier Inc" })
      )
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/suppliers"));
  });

  it("shows an error banner and stays on the page when the submit fails", async () => {
    apiPost.mockResolvedValue({
      data: null,
      error: "Create failed",
      status: 400,
    });

    renderPage();

    fireEvent.change(screen.getByLabelText(/suppliers\.companyName/), {
      target: { value: "New Supplier Inc" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "suppliers.createSupplier" })
    );

    expect(await screen.findByText("Create failed")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalledWith("/suppliers");
  });

  it("disables the submit button while saving", async () => {
    apiPost.mockReturnValue(new Promise(() => {}));

    renderPage();

    fireEvent.change(screen.getByLabelText(/suppliers\.companyName/), {
      target: { value: "New Supplier Inc" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "suppliers.createSupplier" })
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "common.saving" })
      ).toBeDisabled()
    );
  });
});
