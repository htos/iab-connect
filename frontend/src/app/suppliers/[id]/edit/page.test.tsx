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
 * E22-S4: Characterization tests for the EDIT Supplier page (REQ-032).
 *
 * Pins the CURRENT observable behaviour of
 * `frontend/src/app/suppliers/[id]/edit/page.tsx` BEFORE the E22-S4 form-slice
 * refactor (RHF+Zod). Admin-only. The observable contract: a
 * `GET /api/v1/suppliers/{id}` prefills the form; a happy-path submit fires
 * `PUT /api/v1/suppliers/{id}` and redirects to `/suppliers`; a submit error
 * shows the banner; load + saving states.
 */

vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

const push = vi.fn();
const router = { push, replace: vi.fn(), refresh: vi.fn() };
const params = { id: "11111111-1111-1111-1111-111111111111" };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useParams: () => params,
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

const apiGet = vi.fn();
const apiPut = vi.fn();
const apiClient = {
  get: apiGet,
  post: vi.fn(),
  put: apiPut,
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

import EditSupplierPage from "./page";

const SUPPLIER_ID = "11111111-1111-1111-1111-111111111111";

const DETAIL = {
  id: SUPPLIER_ID,
  companyName: "Acme Supplies",
  contactPerson: "Carl Contact",
  email: "info@acme.example",
  phone: null,
  website: null,
  street: null,
  city: null,
  postalCode: null,
  country: null,
  status: "Active",
  category: "Catering",
  notes: null,
  contractLinks: [],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.isAdmin = true;
  apiGet.mockResolvedValue({ data: DETAIL, error: null, status: 200 });
  apiPut.mockResolvedValue({ data: DETAIL, error: null, status: 200 });
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
      <EditSupplierPage />
    </QueryClientProvider>
  );
}

describe("EditSupplierPage — characterization (current behaviour)", () => {
  it("redirects authenticated non-admins to /", async () => {
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("loads the supplier by id and prefills the company-name field", async () => {
    renderPage();

    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith(`/api/v1/suppliers/${SUPPLIER_ID}`)
    );
    await waitFor(() =>
      expect(screen.getByLabelText(/suppliers\.companyName/)).toHaveValue(
        "Acme Supplies"
      )
    );
  });

  it("shows a loading spinner while the GET is pending", async () => {
    apiGet.mockReturnValue(new Promise(() => {}));

    const { container } = renderPage();

    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("submits the update via PUT /api/v1/suppliers/{id} and redirects to /suppliers", async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByLabelText(/suppliers\.companyName/)).toHaveValue(
        "Acme Supplies"
      )
    );
    fireEvent.change(screen.getByLabelText(/suppliers\.companyName/), {
      target: { value: "Acme Supplies Renamed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith(
        `/api/v1/suppliers/${SUPPLIER_ID}`,
        expect.objectContaining({ companyName: "Acme Supplies Renamed" })
      )
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/suppliers"));
  });

  it("shows an error banner when the update fails", async () => {
    apiPut.mockResolvedValue({
      data: null,
      error: "Update failed",
      status: 400,
    });

    renderPage();

    await waitFor(() =>
      expect(screen.getByLabelText(/suppliers\.companyName/)).toHaveValue(
        "Acme Supplies"
      )
    );
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    expect(await screen.findByText("Update failed")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalledWith("/suppliers");
  });
});
