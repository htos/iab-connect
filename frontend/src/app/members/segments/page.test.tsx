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
 * E23-S1: Characterization tests for the Member Segments LIST page (REQ-017).
 *
 * Pins the CURRENT observable behaviour of
 * `frontend/src/app/members/segments/page.tsx` BEFORE the E23-S4 feature-slice
 * refactor, so that refactor is provably behaviour-preserving.
 *
 * Sub-harness note (AC-10/A56): the segments pages use `useApiClient` from
 * `@/lib/auth` (return shape `{ data, error, status }`) — NOT the raw `fetch`
 * the core members pages use. The mocks below return STABLE references
 * (defined once, mutated per test) because the page keeps the api client +
 * filters in its `fetchSegments` `useCallback` dep chain (A64/A78): a fresh
 * object per render would re-fire the fetch effect on every render.
 *
 * Quirks pinned on purpose: delete is an inline TWO-STEP control (`deletingId`
 * → confirm/cancel) gated `{isAdmin && …}` — NOT `confirm()`/`alert()`. The
 * QueryClientProvider wrapper is a forward-compat seam (the god-page does not
 * use TanStack yet) so S4 reuses this spec with no harness churn.
 */

// next-intl: one captured (stable) identity translator (A64).
vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

// next/navigation: stable router so push() is assertable and the redirect
// effect does not churn on identity changes.
const push = vi.fn();
const router = { push, replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

// next/link: render a real anchor so href is observable.
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

// @/lib/auth: configurable auth + spyable, STABLE api client
// (return shape {data,error,status} matches lib/auth.ts useApiClient).
const apiGet = vi.fn();
const apiDelete = vi.fn();
const apiClient = {
  get: apiGet,
  delete: apiDelete,
  post: vi.fn(),
  put: vi.fn(),
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

import MemberSegmentsPage from "./page";

const SEGMENTS = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Alpha Static",
    description: "All active alpha members",
    segmentType: "Static",
    color: "orange",
    isActive: true,
    memberCount: 12,
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Beta Dynamic",
    segmentType: "Dynamic",
    color: "blue",
    isActive: false,
    memberCount: 3,
    createdAt: "2026-02-01T00:00:00Z",
  },
];

function pagedPayload(items: typeof SEGMENTS, overrides = {}) {
  return {
    items,
    totalCount: items.length,
    page: 1,
    pageSize: 20,
    totalPages: 1,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.isAdmin = true;
  authState.isVorstand = true;
  apiGet.mockResolvedValue({
    data: pagedPayload(SEGMENTS),
    error: null,
    status: 200,
  });
  apiDelete.mockResolvedValue({ data: null, error: null, status: 204 });
});

afterEach(cleanup);

// Forward-compat seam (AC-10): the page does not use TanStack yet, but wrapping
// every render in a fresh QueryClientProvider lets the S4 adopter reuse this
// spec without harness rework.
function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberSegmentsPage />
    </QueryClientProvider>
  );
}

describe("MemberSegmentsPage — characterization (current behaviour)", () => {
  it("redirects unauthenticated users to /login and does not fetch", async () => {
    authState.isAuthenticated = false;
    authState.isAdmin = false;
    authState.isVorstand = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("redirects authenticated non-Vorstand-non-Admin users to / and does not fetch", async () => {
    authState.isAuthenticated = true;
    authState.isAdmin = false;
    authState.isVorstand = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("loads segments for an authorized user and renders a row per segment", async () => {
    renderPage();

    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/member-segments?")
      )
    );
    expect(await screen.findByText("Alpha Static")).toBeInTheDocument();
    expect(screen.getByText("Beta Dynamic")).toBeInTheDocument();
  });

  it("fetches the first page with the default page/pageSize query", async () => {
    renderPage();

    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    const url = apiGet.mock.calls[0][0] as string;
    expect(url).toContain("page=1");
    expect(url).toContain("pageSize=20");
  });

  it("renders the segment detail link with the correct href", async () => {
    apiGet.mockResolvedValue({
      data: pagedPayload([SEGMENTS[0]]),
      error: null,
      status: 200,
    });

    renderPage();

    const detail = await screen.findByRole("link", { name: "Alpha Static" });
    expect(detail).toHaveAttribute(
      "href",
      "/members/segments/11111111-1111-1111-1111-111111111111"
    );
  });

  it("submits search on Enter, resetting to page 1 and refetching with search=", async () => {
    renderPage();
    await screen.findByText("Alpha Static");

    const input = screen.getByPlaceholderText("segments.searchPlaceholder");
    fireEvent.change(input, { target: { value: "Beta" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith(
        expect.stringContaining("search=Beta")
      )
    );
    const searchUrl = apiGet.mock.calls
      .map((c) => c[0] as string)
      .find((u) => u.includes("search=Beta"))!;
    expect(searchUrl).toContain("page=1");
  });

  it("changes the type filter -> resets page + refetches with segmentType=", async () => {
    renderPage();
    await screen.findByText("Alpha Static");

    const [typeSelect] = screen.getAllByRole("combobox");
    fireEvent.change(typeSelect, { target: { value: "Dynamic" } });

    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith(
        expect.stringContaining("segmentType=Dynamic")
      )
    );
  });

  it("changes the active filter -> refetches with isActive=", async () => {
    renderPage();
    await screen.findByText("Alpha Static");

    const selects = screen.getAllByRole("combobox");
    const activeSelect = selects[1];
    fireEvent.change(activeSelect, { target: { value: "true" } });

    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith(
        expect.stringContaining("isActive=true")
      )
    );
  });

  it("shows the empty state when no segments are returned", async () => {
    apiGet.mockResolvedValue({
      data: pagedPayload([], { totalCount: 0 }),
      error: null,
      status: 200,
    });

    renderPage();

    expect(await screen.findByText("segments.empty")).toBeInTheDocument();
  });

  it("shows the error banner when the fetch returns an error", async () => {
    apiGet.mockResolvedValue({ data: null, error: "Boom", status: 500 });

    renderPage();

    expect(await screen.findByText("Boom")).toBeInTheDocument();
  });

  it("performs an inline two-step delete (Admin): click delete -> confirm fires api.delete + refetches", async () => {
    apiGet.mockResolvedValue({
      data: pagedPayload([SEGMENTS[0]]),
      error: null,
      status: 200,
    });

    renderPage();
    await screen.findByText("Alpha Static");
    const getCallsBeforeDelete = apiGet.mock.calls.length;

    // step 1: clicking the delete button reveals the inline confirm/cancel
    fireEvent.click(screen.getByTitle("common.delete"));
    const confirmBtn = await screen.findByRole("button", {
      name: "common.confirm",
    });
    expect(
      screen.getByRole("button", { name: "common.cancel" })
    ).toBeInTheDocument();

    // step 2: confirm fires the delete then refetches the list
    fireEvent.click(confirmBtn);

    await waitFor(() =>
      expect(apiDelete).toHaveBeenCalledWith(
        "/api/v1/member-segments/11111111-1111-1111-1111-111111111111"
      )
    );
    await waitFor(() =>
      expect(apiGet.mock.calls.length).toBeGreaterThan(getCallsBeforeDelete)
    );
  });

  it("cancels the inline delete without firing api.delete", async () => {
    apiGet.mockResolvedValue({
      data: pagedPayload([SEGMENTS[0]]),
      error: null,
      status: 200,
    });

    renderPage();
    await screen.findByText("Alpha Static");

    fireEvent.click(screen.getByTitle("common.delete"));
    fireEvent.click(
      await screen.findByRole("button", { name: "common.cancel" })
    );

    // back to the single delete affordance; no delete fired
    expect(await screen.findByTitle("common.delete")).toBeInTheDocument();
    expect(apiDelete).not.toHaveBeenCalled();
  });

  it("does NOT render the delete control for a Vorstand-only (non-Admin) user", async () => {
    authState.isAdmin = false;
    authState.isVorstand = true;
    apiGet.mockResolvedValue({
      data: pagedPayload([SEGMENTS[0]]),
      error: null,
      status: 200,
    });

    renderPage();
    await screen.findByText("Alpha Static");

    expect(screen.queryByTitle("common.delete")).not.toBeInTheDocument();
  });

  it("surfaces a failed delete in the error banner", async () => {
    apiGet.mockResolvedValue({
      data: pagedPayload([SEGMENTS[0]]),
      error: null,
      status: 200,
    });
    apiDelete.mockResolvedValue({
      data: null,
      error: "Delete failed",
      status: 500,
    });

    renderPage();
    await screen.findByText("Alpha Static");

    fireEvent.click(screen.getByTitle("common.delete"));
    fireEvent.click(
      await screen.findByRole("button", { name: "common.confirm" })
    );

    expect(await screen.findByText("Delete failed")).toBeInTheDocument();
  });
});
