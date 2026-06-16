// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// REQ-058 (E8-S4) AC-3/5: the delivery-history page renders metadata rows and never the payload body.
//
// E27-S1 (characterization / regression net): extends the original net with the admin guard
// (AC-1), the pageSize=20 fetch URL, prev/next pagination gated on hasPreviousPage/hasNextPage,
// and the explicit ABSENCE of filters + a retry action (their absence is the correct behaviour,
// pinned here so a future "add retry/filter" change is caught). Pins CURRENT behaviour AS-IS.
//
// A79 deltas: useApiClient runs with `retry: false` at the transport boundary; these tests stub
// the api hook directly (no fetch/retry layer), so no retry-masked deltas are observable here.
//
// Reality divergences from AC text (pinned as the real code):
//  - There are NO filter controls (no event-type / status / date filter) on this page.
//  - There is NO per-row retry action — the page is metadata-only and read-only.
//  - The payload body is never rendered (existing test keeps the no-/payload/i assertion).
//  - The guard target is "/" (NOT "/login").

// HARNESS NOTE (E27-S1): module-level stable translator (not a fresh arrow per render).
const tFn = (key: string) => key;
vi.mock("next-intl", () => ({ useTranslations: () => tFn }));

// Stable router mock so the admin-guard push() target is observable across renders.
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mutable auth state so the admin guard can be exercised. Defaults to an authenticated admin.
const authState = {
  isAuthenticated: true,
  isLoading: false,
  isAdmin: true,
  accessToken: "test-token" as string | undefined,
};
const apiGet = vi.fn();
// Stable api object identity across renders (the load effect lists `api` as a dependency).
const apiClient = { get: apiGet };
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => apiClient,
}));

import WebhookDeliveriesPage from "./page";

// E27-S5 feature-slice adaptation (A88, mirrors the E25-S3 admission): the page now
// routes through the `features/admin-integrations` slice, whose hook uses TanStack
// Query (the page index is part of the query key). The ONLY harness change is wrapping
// the render in a `QueryClientProvider` (retry:false) — the `@/lib/auth` mock seam is
// unchanged and EVERY behavioural assertion below is preserved verbatim (including the
// pageSize=20 URL, prev/next gating, and the no-filter/no-retry absence pins).
function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <WebhookDeliveriesPage />
    </QueryClientProvider>
  );
}

function deliveryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "1",
    subscriptionId: "s1",
    eventType: "event.created",
    targetUrl: "https://p.example.com/h",
    status: "Delivered",
    attemptCount: 1,
    responseStatusCode: 200,
    error: null,
    createdAt: "2026-06-07T00:00:00Z",
    lastAttemptAt: "2026-06-07T00:00:01Z",
    nextRetryAt: null,
    ...overrides,
  };
}

function pagedResult(
  items: unknown[],
  overrides: Record<string, unknown> = {}
) {
  return {
    items,
    totalCount: items.length,
    page: 1,
    pageSize: 20,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.isAdmin = true;
  authState.accessToken = "test-token";
});

describe("WebhookDeliveriesPage", () => {
  it("renders delivery rows with status + code, no payload body", async () => {
    apiGet.mockResolvedValue({
      data: pagedResult([deliveryRow()]),
      error: null,
      status: 200,
    });

    renderPage();
    await waitFor(() =>
      expect(screen.getByText("event.created")).toBeInTheDocument()
    );
    expect(screen.getByText("Delivered")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
    // No payload column / body is rendered.
    expect(screen.queryByText(/payload/i)).not.toBeInTheDocument();
  });

  it("shows empty state when there are no deliveries", async () => {
    apiGet.mockResolvedValue({
      data: pagedResult([], { totalCount: 0, totalPages: 0 }),
      error: null,
      status: 200,
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("noDeliveries")).toBeInTheDocument()
    );
  });

  // --- E27-S1 added: admin guard (AC-1) ---

  it("redirects a non-admin to / and does not fetch", async () => {
    authState.isAdmin = false;
    apiGet.mockResolvedValue({
      data: pagedResult([]),
      error: null,
      status: 200,
    });
    renderPage();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("redirects an unauthenticated user to / and does not fetch", async () => {
    authState.isAuthenticated = false;
    apiGet.mockResolvedValue({
      data: pagedResult([]),
      error: null,
      status: 200,
    });
    renderPage();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("does not fetch when the access token is missing", async () => {
    authState.accessToken = undefined;
    apiGet.mockResolvedValue({
      data: pagedResult([]),
      error: null,
      status: 200,
    });
    renderPage();
    await waitFor(() => {});
    expect(push).not.toHaveBeenCalled();
    expect(apiGet).not.toHaveBeenCalled();
  });

  // --- E27-S1 added: fetch URL pins page + pageSize=20 ---

  it("fetches the first page with pageSize=20", async () => {
    apiGet.mockResolvedValue({
      data: pagedResult([deliveryRow()]),
      error: null,
      status: 200,
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("event.created")).toBeInTheDocument()
    );
    expect(apiGet).toHaveBeenCalledWith(
      "/api/v1/admin/webhook-deliveries/?page=1&pageSize=20"
    );
  });

  // --- E27-S1 added: pagination prev/next gating + page advance ---

  it("disables previous on the first page and advances to page 2 via next", async () => {
    apiGet.mockImplementation((endpoint: string) => {
      if (endpoint.includes("page=2")) {
        return Promise.resolve({
          data: pagedResult([deliveryRow({ id: "2", eventType: "page.two" })], {
            page: 2,
            totalPages: 2,
            hasNextPage: false,
            hasPreviousPage: true,
          }),
          error: null,
          status: 200,
        });
      }
      return Promise.resolve({
        data: pagedResult([deliveryRow({ id: "1", eventType: "page.one" })], {
          page: 1,
          totalPages: 2,
          hasNextPage: true,
          hasPreviousPage: false,
        }),
        error: null,
        status: 200,
      });
    });

    renderPage();
    await waitFor(() =>
      expect(screen.getByText("page.one")).toBeInTheDocument()
    );

    const prevBtn = screen.getByText("previous").closest("button")!;
    const nextBtn = screen.getByText("next").closest("button")!;
    // First page: previous disabled (hasPreviousPage=false), next enabled.
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeEnabled();

    fireEvent.click(nextBtn);
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith(
        "/api/v1/admin/webhook-deliveries/?page=2&pageSize=20"
      )
    );
    await waitFor(() =>
      expect(screen.getByText("page.two")).toBeInTheDocument()
    );
    // Last page: next now disabled (hasNextPage=false), previous enabled.
    expect(screen.getByText("next").closest("button")!).toBeDisabled();
    expect(screen.getByText("previous").closest("button")!).toBeEnabled();
  });

  // --- E27-S1 added: AC pins — NO filters, NO retry action (absence is correct) ---

  it("renders no filter controls and no retry action (read-only metadata view)", async () => {
    apiGet.mockResolvedValue({
      data: pagedResult([
        deliveryRow({ status: "Failed", responseStatusCode: 500 }),
      ]),
      error: null,
      status: 200,
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("event.created")).toBeInTheDocument()
    );
    // No retry affordance even on a Failed delivery.
    expect(screen.queryByText(/retry/i)).not.toBeInTheDocument();
    // No filter controls of any kind.
    expect(screen.queryByText(/filter/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    // The only interactive controls are the two pagination buttons.
    expect(screen.getByText("previous")).toBeInTheDocument();
    expect(screen.getByText("next")).toBeInTheDocument();
  });
});
