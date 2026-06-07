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
 * E22-S1: Characterization tests for the EDIT Sponsor page (REQ-031).
 *
 * Pins the CURRENT observable behaviour of
 * `frontend/src/app/sponsors/[id]/edit/page.tsx` BEFORE the E22-S3 form-slice
 * refactor (RHF+Zod, DEC-1). The observable contract: a `GET /api/v1/sponsors/{id}`
 * prefills the form; a happy-path submit fires `PUT /api/v1/sponsors/{id}` and
 * redirects to `/sponsors`; a submit error shows the banner; load + saving states.
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
  isVorstand: false,
  isAdmin: true,
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => apiClient,
}));

import EditSponsorPage from "./page";

const SPONSOR_ID = "11111111-1111-1111-1111-111111111111";

const DETAIL = {
  id: SPONSOR_ID,
  companyName: "Acme Corp",
  contactPerson: "Carl Contact",
  email: "info@acme.example",
  phone: null,
  website: null,
  street: null,
  city: null,
  postalCode: null,
  country: null,
  status: "Active",
  tier: "Gold",
  notes: null,
  agreementStart: null,
  agreementEnd: null,
  packages: [],
  contractLinks: [],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.isVorstand = false;
  authState.isAdmin = true;
  apiGet.mockResolvedValue({ data: DETAIL, error: null, status: 200 });
  apiPut.mockResolvedValue({ data: DETAIL, error: null, status: 200 });
});

afterEach(cleanup);

// E22-S3 seam: the page now uses TanStack Query (GET prefill + update mutation),
// so it must render inside a QueryClientProvider. Harness change only — the
// behaviour assertions are unchanged.
function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <EditSponsorPage />
    </QueryClientProvider>
  );
}

describe("EditSponsorPage — characterization (current behaviour)", () => {
  it("redirects authenticated users who are neither Vorstand nor Admin to /", async () => {
    authState.isVorstand = false;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("loads the sponsor by id and prefills the company-name field", async () => {
    renderPage();

    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith(`/api/v1/sponsors/${SPONSOR_ID}`)
    );
    await waitFor(() =>
      expect(screen.getByLabelText(/sponsors\.companyName/)).toHaveValue(
        "Acme Corp"
      )
    );
  });

  it("shows a loading spinner while the GET is pending", async () => {
    apiGet.mockReturnValue(new Promise(() => {}));

    const { container } = renderPage();

    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("submits the update via PUT /api/v1/sponsors/{id} and redirects to /sponsors", async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByLabelText(/sponsors\.companyName/)).toHaveValue(
        "Acme Corp"
      )
    );
    fireEvent.change(screen.getByLabelText(/sponsors\.companyName/), {
      target: { value: "Acme Corp Renamed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith(
        `/api/v1/sponsors/${SPONSOR_ID}`,
        expect.objectContaining({ companyName: "Acme Corp Renamed" })
      )
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/sponsors"));
  });

  it("shows an error banner when the update fails", async () => {
    apiPut.mockResolvedValue({
      data: null,
      error: "Update failed",
      status: 400,
    });

    renderPage();

    await waitFor(() =>
      expect(screen.getByLabelText(/sponsors\.companyName/)).toHaveValue(
        "Acme Corp"
      )
    );
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    expect(await screen.findByText("Update failed")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalledWith("/sponsors");
  });
});
