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
 * E22-S1: Characterization tests for the Sponsors DETAIL page (REQ-031).
 *
 * Pins the CURRENT observable behaviour of
 * `frontend/src/app/sponsors/[id]/page.tsx` BEFORE the E22-S3 feature-slice
 * refactor (the mutation-heavy surface: 7 endpoints + inline package/link CRUD +
 * status change + delete). Asserts the observable surface — DOM + which
 * `useApiClient` calls fire — not internals.
 *
 * Mock fidelity (A78): stable router/params/api references; `alert` stubbed
 * because the current page surfaces mutation errors via `window.alert`.
 * A79 awareness: wrapped in a `QueryClientProvider` (retry:false) because the
 * detail page becomes a TanStack consumer after E22-S3 (DEC-2).
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
  isVorstand: false,
  isAdmin: true,
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => apiClient,
}));

import SponsorDetailPage from "./page";

const SPONSOR_ID = "11111111-1111-1111-1111-111111111111";

function makeDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: SPONSOR_ID,
    companyName: "Acme Corp",
    contactPerson: "Carl Contact",
    email: "info@acme.example",
    phone: "+41 00 000 00 00",
    website: "https://acme.example",
    street: null,
    city: null,
    postalCode: null,
    country: null,
    status: "Active",
    tier: "Gold",
    notes: "Important partner",
    agreementStart: "2026-01-01",
    agreementEnd: "2026-12-31",
    packages: [],
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
  authState.isVorstand = false;
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
      <SponsorDetailPage />
    </QueryClientProvider>
  );
}

describe("SponsorDetailPage — characterization (current behaviour)", () => {
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
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("loads the sponsor by id and renders contact + sponsor info", async () => {
    renderPage();

    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith(`/api/v1/sponsors/${SPONSOR_ID}`)
    );
    expect(await screen.findByText("Carl Contact")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "info@acme.example" })
    ).toBeInTheDocument();
    // notes + agreement surface present
    expect(screen.getByText("Important partner")).toBeInTheDocument();
  });

  it("renders the not-found state when the GET returns 404", async () => {
    apiGet.mockResolvedValue({ data: null, error: null, status: 404 });

    renderPage();

    expect(await screen.findByText("sponsors.notFound")).toBeInTheDocument();
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

    // the only combobox on load is the Quick Actions status select
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Paused" },
    });

    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith(
        `/api/v1/sponsors/${SPONSOR_ID}/status`,
        { status: "Paused" }
      )
    );
  });

  it("deletes the sponsor and redirects to /sponsors", async () => {
    renderPage();
    await screen.findByText("Carl Contact");

    // header delete button (admin-only)
    fireEvent.click(screen.getByRole("button", { name: "common.delete" }));
    expect(
      await screen.findByText("sponsors.confirmDeleteTitle")
    ).toBeInTheDocument();

    const deleteButtons = screen.getAllByRole("button", {
      name: "common.delete",
    });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);

    await waitFor(() =>
      expect(apiDelete).toHaveBeenCalledWith(`/api/v1/sponsors/${SPONSOR_ID}`)
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/sponsors"));
  });

  it("does NOT render the delete affordance for a Vorstand-but-not-Admin user", async () => {
    authState.isVorstand = true;
    authState.isAdmin = false;

    renderPage();
    await screen.findByText("Carl Contact");

    expect(
      screen.queryByRole("button", { name: "common.delete" })
    ).not.toBeInTheDocument();
  });

  it("shows the packages empty state when there are no packages", async () => {
    renderPage();

    expect(await screen.findByText("sponsors.noPackages")).toBeInTheDocument();
  });

  it("adds a package via POST /packages", async () => {
    renderPage();
    await screen.findByText("Carl Contact");

    // open the add-package form (toggle button)
    fireEvent.click(
      screen.getByRole("button", { name: "sponsors.addPackage" })
    );
    fireEvent.change(screen.getByPlaceholderText("sponsors.packageName"), {
      target: { value: "Logo on banner" },
    });
    // after opening, exactly one "sponsors.addPackage" button remains (the submit)
    fireEvent.click(
      screen.getByRole("button", { name: "sponsors.addPackage" })
    );

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        `/api/v1/sponsors/${SPONSOR_ID}/packages`,
        expect.objectContaining({ name: "Logo on banner" })
      )
    );
  });

  it("removes a package via DELETE /packages/{packageId}", async () => {
    apiGet.mockResolvedValue({
      data: makeDetail({
        packages: [
          {
            id: "pkg-1",
            name: "Gold package",
            description: null,
            amount: 1000,
            currency: "CHF",
          },
        ],
      }),
      error: null,
      status: 200,
    });

    renderPage();
    await screen.findByText("Gold package");

    fireEvent.click(
      screen.getByRole("button", { name: "sponsors.removePackage" })
    );

    await waitFor(() =>
      expect(apiDelete).toHaveBeenCalledWith(
        `/api/v1/sponsors/${SPONSOR_ID}/packages/pkg-1`
      )
    );
  });

  it("shows the contract-links empty state when there are no links", async () => {
    renderPage();

    expect(await screen.findByText("sponsors.noLinks")).toBeInTheDocument();
  });

  it("adds a contract link via POST /links", async () => {
    renderPage();
    await screen.findByText("Carl Contact");

    fireEvent.click(screen.getByRole("button", { name: "sponsors.addLink" }));
    fireEvent.change(screen.getByPlaceholderText("sponsors.linkTargetId"), {
      target: { value: "doc-42" },
    });
    fireEvent.click(screen.getByRole("button", { name: "sponsors.addLink" }));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        `/api/v1/sponsors/${SPONSOR_ID}/links`,
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
    await screen.findByText("sponsors.removeLink");

    fireEvent.click(
      screen.getByRole("button", { name: "sponsors.removeLink" })
    );

    await waitFor(() =>
      expect(apiDelete).toHaveBeenCalledWith(
        `/api/v1/sponsors/${SPONSOR_ID}/links/link-1`
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
    expect(push).not.toHaveBeenCalledWith("/sponsors");
  });
});
