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
 * E22-S4: Characterization tests for the Suppliers DETAIL page (REQ-032).
 *
 * Pins the CURRENT observable behaviour of
 * `frontend/src/app/suppliers/[id]/page.tsx` BEFORE the E22-S4 feature-slice
 * refactor (which completes the E21 pilot: the list was migrated, detail/new/edit
 * were left as god-pages). Suppliers detail is simpler than Sponsors — admin-only
 * (no Vorstand), `category` not `tier`, contract links only (NO packages).
 *
 * Asserts the observable surface — DOM + which `useApiClient` calls fire — not
 * internals. `alert` stubbed (mutation errors surface via it); wrapped in a
 * `QueryClientProvider` (retry:false) because the page becomes a TanStack consumer.
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
const apiPost = vi.fn();
const apiDelete = vi.fn();
const apiClient = {
  get: apiGet,
  put: apiPut,
  post: apiPost,
  delete: apiDelete,
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

import SupplierDetailPage from "./page";

const SUPPLIER_ID = "11111111-1111-1111-1111-111111111111";

function makeDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: SUPPLIER_ID,
    companyName: "Acme Supplies",
    contactPerson: "Carl Contact",
    email: "info@acme.example",
    phone: "+41 00 000 00 00",
    website: "https://acme.example",
    street: null,
    city: null,
    postalCode: null,
    country: null,
    status: "Active",
    category: "Catering",
    notes: "Important partner",
    contractLinks: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("alert", vi.fn());
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.isAdmin = true;
  apiGet.mockResolvedValue({ data: makeDetail(), error: null, status: 200 });
  apiPut.mockResolvedValue({ data: makeDetail(), error: null, status: 200 });
  apiPost.mockResolvedValue({ data: makeDetail(), error: null, status: 200 });
  apiDelete.mockResolvedValue({ data: makeDetail(), error: null, status: 200 });
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
      <SupplierDetailPage />
    </QueryClientProvider>
  );
}

describe("SupplierDetailPage — characterization (current behaviour)", () => {
  it("redirects unauthenticated users to /login", async () => {
    authState.isAuthenticated = false;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });

  it("redirects authenticated non-admins to / and does not fetch", async () => {
    authState.isAuthenticated = true;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("loads the supplier by id and renders contact + supplier info", async () => {
    renderPage();

    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith(`/api/v1/suppliers/${SUPPLIER_ID}`)
    );
    expect(await screen.findByText("Carl Contact")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "info@acme.example" })
    ).toBeInTheDocument();
    expect(screen.getByText("Important partner")).toBeInTheDocument();
  });

  it("renders the not-found state when the GET returns 404", async () => {
    apiGet.mockResolvedValue({ data: null, error: null, status: 404 });

    renderPage();

    expect(await screen.findByText("suppliers.notFound")).toBeInTheDocument();
  });

  it("renders the error state when the GET returns an error", async () => {
    apiGet.mockResolvedValue({ data: null, error: "Boom", status: 500 });

    renderPage();

    expect(await screen.findByText("Boom")).toBeInTheDocument();
  });

  it("shows a loading spinner while the GET is pending", async () => {
    apiGet.mockReturnValue(new Promise(() => {}));

    const { container } = renderPage();

    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("changes status via PUT /status when the status select changes", async () => {
    renderPage();
    await screen.findByText("Carl Contact");

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Paused" },
    });

    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith(
        `/api/v1/suppliers/${SUPPLIER_ID}/status`,
        { status: "Paused" }
      )
    );
  });

  it("deletes the supplier and redirects to /suppliers", async () => {
    renderPage();
    await screen.findByText("Carl Contact");

    fireEvent.click(screen.getByRole("button", { name: "common.delete" }));
    expect(
      await screen.findByText("suppliers.confirmDeleteTitle")
    ).toBeInTheDocument();

    const deleteButtons = screen.getAllByRole("button", {
      name: "common.delete",
    });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);

    await waitFor(() =>
      expect(apiDelete).toHaveBeenCalledWith(`/api/v1/suppliers/${SUPPLIER_ID}`)
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/suppliers"));
  });

  it("shows the contract-links empty state when there are no links", async () => {
    renderPage();

    expect(await screen.findByText("suppliers.noLinks")).toBeInTheDocument();
  });

  it("adds a contract link via POST /links", async () => {
    renderPage();
    await screen.findByText("Carl Contact");

    fireEvent.click(screen.getByRole("button", { name: "suppliers.addLink" }));
    fireEvent.change(screen.getByPlaceholderText("suppliers.linkTargetId"), {
      target: { value: "doc-42" },
    });
    fireEvent.click(screen.getByRole("button", { name: "suppliers.addLink" }));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        `/api/v1/suppliers/${SUPPLIER_ID}/links`,
        expect.objectContaining({ targetId: "doc-42" })
      )
    );
  });

  it("removes a contract link via DELETE /links/{linkId}", async () => {
    apiGet.mockResolvedValue({
      data: makeDetail({
        contractLinks: [
          {
            id: "link-1",
            linkType: "Document",
            targetId: "doc-1",
            description: null,
            createdAt: "2026-01-01T00:00:00Z",
          },
        ],
      }),
      error: null,
      status: 200,
    });

    renderPage();
    await screen.findByText("suppliers.removeLink");

    fireEvent.click(
      screen.getByRole("button", { name: "suppliers.removeLink" })
    );

    await waitFor(() =>
      expect(apiDelete).toHaveBeenCalledWith(
        `/api/v1/suppliers/${SUPPLIER_ID}/links/link-1`
      )
    );
  });

  it("A76: the delete affordance is visibly destructive", async () => {
    renderPage();
    await screen.findByText("Carl Contact");

    const deleteButton = screen.getByRole("button", { name: "common.delete" });
    expect(deleteButton.className).toMatch(/red|destructive/);
  });

  it("A76: a failed delete surfaces an error (alert) and does not redirect", async () => {
    const alertSpy = vi.fn();
    vi.stubGlobal("alert", alertSpy);
    apiDelete.mockResolvedValue({
      data: null,
      error: "Delete failed",
      status: 500,
    });

    renderPage();
    await screen.findByText("Carl Contact");

    fireEvent.click(screen.getByRole("button", { name: "common.delete" }));
    const deleteButtons = await screen.findAllByRole("button", {
      name: "common.delete",
    });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Delete failed"));
    expect(push).not.toHaveBeenCalledWith("/suppliers");
  });
});
