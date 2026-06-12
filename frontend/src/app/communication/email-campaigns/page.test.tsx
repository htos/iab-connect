// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
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
 * E25-S1 net, ADAPTED for the E25-S3 feature-slice extraction. The page now routes
 * through the slice's `useApiClient`-based api layer instead of an inline `fetch`,
 * so the transport seam moves from a global `fetch` spy to a STABLE `useApiClient`
 * spy (the documented A88 adaptation): `vi.mock("@/lib/auth")` now also returns a
 * `useApiClient()` whose `get`/`delete` resolve `{ data, error, status }` per test,
 * and the transport assertions are re-pointed from "global fetch with URL/method"
 * to "`api.get`/`api.delete` with endpoint X". EVERY behavioural assertion is
 * preserved verbatim: the auth gate (push /login vs /), no fetch for unauthorised,
 * page=1/pageSize=10, the status badge translated label, the per-row Draft-only
 * edit/delete, the delete confirm→DELETE→refetch + the deleteError/server-message
 * alert, the client-side search (no refetch), empty + loadError + pagination.
 */

vi.mock("next-intl", () => {
  const translate = (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key;
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

const authState = {
  isAuthenticated: true,
  isLoading: false,
  isVorstand: true,
  isAdmin: false,
  accessToken: "tok" as string | null,
};

// A88 transport seam: a STABLE api-client spy (the slice routes through
// `useApiClient`). Methods resolve `{ data, error, status }` per test.
const apiClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  upload: vi.fn(),
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => apiClient,
}));

import EmailCampaignsPage from "./page";

function makeCampaign(overrides: Record<string, unknown> = {}) {
  return {
    id: "c1",
    name: "Spring Newsletter",
    subject: "Welcome Spring",
    htmlContent: "<p>hi</p>",
    fromName: "Club",
    fromEmail: "club@example.org",
    segmentType: "AllActiveMembers",
    status: "Draft",
    totalRecipients: 5,
    sentCount: 0,
    deliveredCount: 0,
    openedCount: 0,
    clickedCount: 0,
    bouncedCount: 0,
    failedCount: 0,
    createdById: "u1",
    createdByName: "Alice",
    createdAt: "2026-01-15T00:00:00Z",
    ...overrides,
  };
}

// Per-test transport state.
let listOk: boolean;
let listPayload: {
  items: ReturnType<typeof makeCampaign>[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
let deleteOk: boolean;
let deleteError: string | null;

function listCalls() {
  return apiClient.get.mock.calls.filter(
    (c) =>
      typeof c[0] === "string" &&
      (c[0] as string).includes("/api/v1/email-campaigns?")
  );
}

function deleteCalls() {
  return apiClient.delete.mock.calls.filter(
    (c) => typeof c[0] === "string"
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.isVorstand = true;
  authState.isAdmin = false;
  authState.accessToken = "tok";

  listOk = true;
  listPayload = {
    items: [makeCampaign()],
    totalCount: 1,
    page: 1,
    pageSize: 10,
    totalPages: 1,
  };
  deleteOk = true;
  deleteError = null;

  apiClient.get.mockImplementation((url: string) => {
    if (url.includes("/api/v1/email-campaigns?")) {
      return Promise.resolve(
        listOk
          ? { data: listPayload, error: null, status: 200 }
          : { data: null, error: "loadError", status: 500 }
      );
    }
    return Promise.resolve({ data: null, error: null, status: 200 });
  });
  apiClient.delete.mockImplementation(() =>
    Promise.resolve(
      deleteOk
        ? { data: null, error: null, status: 200 }
        : { data: null, error: deleteError, status: 400 }
    )
  );

  vi.stubGlobal(
    "confirm",
    vi.fn(() => true)
  );
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
      <EmailCampaignsPage />
    </QueryClientProvider>
  );
}

describe("EmailCampaignsPage (list) — characterization (current behaviour)", () => {
  // --- auth guard (Vorstand OR Admin only) ---

  it("redirects an unauthenticated user to /login and fires no list fetch", async () => {
    authState.isAuthenticated = false;
    authState.isVorstand = false;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(listCalls()).toHaveLength(0);
  });

  it("redirects an authenticated Member-only user to / and fires no list fetch", async () => {
    authState.isAuthenticated = true;
    authState.isVorstand = false;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(listCalls()).toHaveLength(0);
  });

  it("loads the list for a Vorstand-only user", async () => {
    renderPage();

    await waitFor(() => expect(listCalls().length).toBeGreaterThan(0));
    expect(await screen.findByText("Spring Newsletter")).toBeInTheDocument();
  });

  it("loads the list for an Admin-only user", async () => {
    authState.isVorstand = false;
    authState.isAdmin = true;

    renderPage();

    await waitFor(() => expect(listCalls().length).toBeGreaterThan(0));
    expect(await screen.findByText("Spring Newsletter")).toBeInTheDocument();
  });

  it("does not fetch when there is no access token (stays on the spinner)", async () => {
    authState.accessToken = null;

    const { container } = renderPage();

    // Auth guard passes (Vorstand) but the list query is disabled while the token
    // is missing → `loading` stays true → the spinner persists.
    await waitFor(() =>
      expect(container.querySelector(".animate-spin")).toBeInTheDocument()
    );
    expect(listCalls()).toHaveLength(0);
  });

  // --- list load + query args (page=1, pageSize=10) ---

  it("requests the first page with page=1 and pageSize=10", async () => {
    renderPage();

    await waitFor(() => expect(listCalls().length).toBeGreaterThan(0));
    const url = listCalls()[0][0] as string;
    expect(url).toContain("page=1");
    expect(url).toContain("pageSize=10");
  });

  it("routes the list load through the api client (auth encapsulated)", async () => {
    renderPage();

    // A88: the Bearer token is now owned by `useApiClient`; the meaningful transport
    // assertion is that the list GET fired against the campaigns endpoint.
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(0));
    expect(listCalls()[0][0]).toContain("/api/v1/email-campaigns?");
  });

  // --- status badge + label ---

  it("renders the status badge with the translated status label", async () => {
    renderPage();
    await screen.findByText("Spring Newsletter");

    // `statusDraft` also appears as a <select> <option>; pin the row BADGE, which
    // carries the shared Badge `rounded-full` pill classes.
    const badge = screen.getByText("statusDraft", { selector: "div" });
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("rounded-full");
  });

  // --- per-row Draft-only edit/delete affordances ---

  it("renders Details + Edit + Delete for a Draft campaign", async () => {
    renderPage();
    await screen.findByText("Spring Newsletter");

    expect(screen.getByText("details")).toBeInTheDocument();
    expect(screen.getByText("edit")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "delete" })).toBeInTheDocument();
  });

  it("renders only Details (no Edit/Delete) for a non-Draft (Sent) campaign", async () => {
    listPayload.items = [
      makeCampaign({ status: "Sent", sentCount: 5, openedCount: 2 }),
    ];

    renderPage();
    await screen.findByText("Spring Newsletter");

    expect(screen.getByText("details")).toBeInTheDocument();
    expect(screen.queryByText("edit")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "delete" })
    ).not.toBeInTheDocument();
  });

  // --- delete: confirm gate → DELETE → refetch / error alert ---

  it("delete confirms, DELETEs the campaign, then refetches the list", async () => {
    renderPage();
    await screen.findByText("Spring Newsletter");
    const before = listCalls().length;

    fireEvent.click(screen.getByRole("button", { name: "delete" }));

    const confirmMock = confirm as unknown as ReturnType<typeof vi.fn>;
    expect(confirmMock).toHaveBeenCalled();

    await waitFor(() => {
      const del = deleteCalls()[0];
      expect(del).toBeTruthy();
      expect(del![0]).toBe("/api/v1/email-campaigns/c1");
    });
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(before));
  });

  it("does not DELETE when the delete confirm is cancelled", async () => {
    vi.stubGlobal(
      "confirm",
      vi.fn(() => false)
    );

    renderPage();
    await screen.findByText("Spring Newsletter");

    fireEvent.click(screen.getByRole("button", { name: "delete" }));

    expect(deleteCalls()[0]).toBeFalsy();
  });

  it("alerts when the delete fetch is not ok (deleteError fallback)", async () => {
    deleteOk = false;
    deleteError = null;
    const alertMock = vi.fn();
    vi.stubGlobal("alert", alertMock);

    renderPage();
    await screen.findByText("Spring Newsletter");

    fireEvent.click(screen.getByRole("button", { name: "delete" }));

    await waitFor(() => expect(alertMock).toHaveBeenCalledWith("deleteError"));
  });

  it("alerts the server message when the delete error response carries a message", async () => {
    deleteOk = false;
    deleteError = "Cannot delete";
    const alertMock = vi.fn();
    vi.stubGlobal("alert", alertMock);

    renderPage();
    await screen.findByText("Spring Newsletter");

    fireEvent.click(screen.getByRole("button", { name: "delete" }));

    await waitFor(() =>
      expect(alertMock).toHaveBeenCalledWith("Cannot delete")
    );
  });

  // --- status filter resets page→1 and refetches with status= ---

  it("changing the status filter refetches with status= and page=1", async () => {
    renderPage();
    await screen.findByText("Spring Newsletter");
    const before = listCalls().length;

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Sent" },
    });

    await waitFor(() => expect(listCalls().length).toBeGreaterThan(before));
    const url = listCalls().at(-1)![0] as string;
    expect(url).toContain("status=Sent");
    expect(url).toContain("page=1");
  });

  // --- client-side search filter (no refetch) ---

  it("filters the rendered rows client-side by the search term without refetching", async () => {
    listPayload.items = [
      makeCampaign({ id: "c1", name: "Spring Newsletter" }),
      makeCampaign({ id: "c2", name: "Autumn Update", subject: "Fall" }),
    ];

    renderPage();
    await screen.findByText("Spring Newsletter");
    const before = listCalls().length;

    fireEvent.change(screen.getByPlaceholderText("searchCampaigns"), {
      target: { value: "autumn" },
    });

    expect(screen.queryByText("Spring Newsletter")).not.toBeInTheDocument();
    expect(screen.getByText("Autumn Update")).toBeInTheDocument();
    // search is purely client-side: no new fetch.
    expect(listCalls().length).toBe(before);
  });

  // --- empty state ---

  it("renders the no-campaigns-found empty row when the list is empty", async () => {
    listPayload.items = [];
    listPayload.totalCount = 0;

    renderPage();

    expect(await screen.findByText("noCampaignsFound")).toBeInTheDocument();
  });

  // --- load error banner ---

  it("surfaces the loadError banner when the list fetch is not ok", async () => {
    listOk = false;

    renderPage();

    expect(await screen.findByText("loadError")).toBeInTheDocument();
  });

  // --- pagination ---

  it("does not render pagination when totalPages === 1", async () => {
    renderPage();
    await screen.findByText("Spring Newsletter");

    expect(
      screen.queryByRole("button", { name: "previous" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "next" })
    ).not.toBeInTheDocument();
  });

  it("disables Prev at page 1 and enables Next when totalPages > 1", async () => {
    listPayload.totalPages = 3;
    listPayload.totalCount = 25;

    renderPage();
    await screen.findByText("Spring Newsletter");

    expect(screen.getByRole("button", { name: "previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "next" })).toBeEnabled();
  });

  it("clicking Next refetches with page=2", async () => {
    listPayload.totalPages = 3;
    listPayload.totalCount = 25;

    renderPage();
    await screen.findByText("Spring Newsletter");
    const before = listCalls().length;

    fireEvent.click(screen.getByRole("button", { name: "next" }));

    await waitFor(() => expect(listCalls().length).toBeGreaterThan(before));
    const url = listCalls().at(-1)![0] as string;
    expect(url).toContain("page=2");
  });

  // --- loading lifecycle ---

  it("renders the loading spinner while the list load is pending", async () => {
    apiClient.get.mockImplementation(() => new Promise(() => {}));

    const { container } = renderPage();

    await waitFor(() =>
      expect(container.querySelector(".animate-spin")).toBeInTheDocument()
    );
  });
});
