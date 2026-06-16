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
 * E22-S1: Characterization tests for the Sponsors LIST page (REQ-031).
 *
 * Pins the CURRENT observable behaviour of `frontend/src/app/sponsors/page.tsx`
 * BEFORE the E22-S2 feature-slice refactor, so that refactor is provably
 * behaviour-preserving. The Sponsors pages have zero tests today.
 *
 * These tests assert the OBSERVABLE surface — what the DOM renders and which
 * `useApiClient` calls fire — NOT internals (`useState`/`startTransition`) that
 * the refactor will legitimately change. Two Sponsors-specific quirks are pinned
 * on purpose (load-bearing, they differ from the Suppliers pilot):
 *   - the LIST is visible to `isVorstand || isAdmin` (NOT admin-only);
 *   - the DELETE affordance is `isAdmin`-only.
 * Status filter is SERVER-side (`?status=`); search is CLIENT-side; the list
 * renders BOTH a status badge and a tier badge.
 *
 * A76 (the E21 lesson): a manual→TanStack/Radix refactor silently changes the
 * destructive-button affordance and the error/empty/loading lifecycle incl. the
 * failure branch. The green E21-S2 suite missed exactly P2 (delete-confirm button
 * regressed destructive→primary) and P3 (delete-error display). This suite
 * therefore asserts (a) the delete affordance is visibly destructive, and (b) a
 * delete FAILURE surfaces an error without wiping the list.
 *
 * Mock fidelity (A78): the real `useApiClient`/`useRouter` return memoized,
 * STABLE objects and the page puts `api` in its `fetchSponsors` dependency chain.
 * The mocks below return stable references — a fresh object per render would make
 * the fetch effect re-fire on every render.
 *
 * A79 awareness: the render is wrapped in a `QueryClientProvider` with
 * `retry: false` so the list page (a TanStack consumer after E22-S2) stays
 * deterministic. `retry: false` masks the provider's `retry: 1`,
 * sticky-mutation-error, and no-spinner-on-refetch deltas — S2 owns those.
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
  isVorstand: false,
  isAdmin: true,
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => apiClient,
}));

import SponsorsPage from "./page";

const SPONSORS = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    companyName: "Alpha GmbH",
    contactPerson: "Anna Alpha",
    email: "anna@alpha.example",
    phone: null,
    status: "Active",
    tier: "Gold",
    agreementStart: null,
    agreementEnd: null,
    packageCount: 3,
    linkCount: 1,
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    companyName: "Beta AG",
    contactPerson: "Bert Beta",
    email: "bert@beta.example",
    phone: null,
    status: "Prospect",
    tier: "Bronze",
    agreementStart: null,
    agreementEnd: null,
    packageCount: 0,
    linkCount: 0,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.isVorstand = false;
  authState.isAdmin = true;
  apiGet.mockResolvedValue({ data: SPONSORS, error: null, status: 200 });
  apiDelete.mockResolvedValue({ data: null, error: null, status: 204 });
});

afterEach(cleanup);

// E22-S2 seam: after the refactor the page uses TanStack Query, so it must
// render inside a QueryClientProvider. A fresh client with retries off keeps the
// suite deterministic. This is a test-harness seam only — the behaviour
// assertions below are unchanged. (Wrapping the current god-page in a provider
// is a harmless no-op.)
function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SponsorsPage />
    </QueryClientProvider>
  );
}

describe("SponsorsPage — characterization (current behaviour)", () => {
  it("redirects unauthenticated users to /login and does not fetch", async () => {
    authState.isAuthenticated = false;
    authState.isVorstand = false;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("redirects authenticated users who are neither Vorstand nor Admin to / and does not fetch", async () => {
    authState.isAuthenticated = true;
    authState.isVorstand = false;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("renders the list for a Vorstand user who is NOT Admin (list gate is isVorstand || isAdmin)", async () => {
    authState.isVorstand = true;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith("/api/v1/sponsors")
    );
    expect(await screen.findByText("Alpha GmbH")).toBeInTheDocument();
  });

  it("does NOT render the delete affordance for a Vorstand-but-not-Admin user (delete is admin-only)", async () => {
    authState.isVorstand = true;
    authState.isAdmin = false;

    renderPage();

    await screen.findByText("Alpha GmbH");
    expect(
      screen.queryByRole("button", { name: "common.delete" })
    ).not.toBeInTheDocument();
  });

  it("renders the delete affordance for an Admin user", async () => {
    authState.isVorstand = false;
    authState.isAdmin = true;

    renderPage();

    await screen.findByText("Alpha GmbH");
    expect(
      screen.getAllByRole("button", { name: "common.delete" }).length
    ).toBeGreaterThan(0);
  });

  it("loads sponsors for an authorized user and renders a row per sponsor", async () => {
    renderPage();

    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith("/api/v1/sponsors")
    );
    expect(await screen.findByText("Alpha GmbH")).toBeInTheDocument();
    expect(screen.getByText("Beta AG")).toBeInTheDocument();
  });

  it("renders the company detail link and the edit link with the correct hrefs", async () => {
    apiGet.mockResolvedValue({
      data: [SPONSORS[0]],
      error: null,
      status: 200,
    });

    renderPage();

    const detail = await screen.findByRole("link", { name: "Alpha GmbH" });
    expect(detail).toHaveAttribute(
      "href",
      "/sponsors/11111111-1111-1111-1111-111111111111"
    );
    const edit = screen.getByRole("link", { name: "common.edit" });
    expect(edit).toHaveAttribute(
      "href",
      "/sponsors/11111111-1111-1111-1111-111111111111/edit"
    );
  });

  it("renders BOTH a status badge and a tier badge for each sponsor", async () => {
    apiGet.mockResolvedValue({
      data: [SPONSORS[0]],
      error: null,
      status: 200,
    });

    renderPage();

    // Wait for the row to load first — the status filter bar already renders a
    // `sponsors.status.Active` <option>, so we must wait for the table (not that
    // option) before asserting the badges.
    await screen.findByText("Alpha GmbH");

    // tier badge text is the raw tier value (not translated) — unique to the row.
    expect(screen.getByText("Gold")).toBeInTheDocument();
    // status badge text is the translated status key; it co-occurs with the
    // filter-bar option of the same text, so the badge is the 2nd+ occurrence.
    expect(
      screen.getAllByText("sponsors.status.Active").length
    ).toBeGreaterThan(1);
  });

  it("shows the package count for each sponsor", async () => {
    apiGet.mockResolvedValue({
      data: [SPONSORS[0]],
      error: null,
      status: 200,
    });

    renderPage();

    await screen.findByText("Alpha GmbH");
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("applies the status filter server-side (re-fetch with ?status=)", async () => {
    renderPage();
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith("/api/v1/sponsors")
    );

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Active" },
    });

    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith("/api/v1/sponsors?status=Active")
    );
  });

  it("filters search client-side without an extra fetch", async () => {
    renderPage();
    await screen.findByText("Alpha GmbH");
    const callsAfterLoad = apiGet.mock.calls.length;

    fireEvent.change(
      screen.getByPlaceholderText("sponsors.searchPlaceholder"),
      { target: { value: "Beta" } }
    );

    await waitFor(() =>
      expect(screen.queryByText("Alpha GmbH")).not.toBeInTheDocument()
    );
    expect(screen.getByText("Beta AG")).toBeInTheDocument();
    // search is purely client-side: no additional GET fired
    expect(apiGet.mock.calls.length).toBe(callsAfterLoad);
  });

  it("shows the empty state when no sponsors are returned", async () => {
    apiGet.mockResolvedValue({ data: [], error: null, status: 200 });

    renderPage();

    expect(await screen.findByText("sponsors.empty")).toBeInTheDocument();
  });

  it("shows the error state when the fetch returns an error", async () => {
    apiGet.mockResolvedValue({ data: null, error: "Boom", status: 500 });

    renderPage();

    expect(await screen.findByText("Boom")).toBeInTheDocument();
  });

  it("shows a loading spinner while the fetch is pending", async () => {
    apiGet.mockReturnValue(new Promise(() => {})); // never resolves → stays loading

    const { container } = renderPage();

    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("opens the delete dialog, deletes, then refreshes the list", async () => {
    apiGet.mockResolvedValue({
      data: [SPONSORS[0]],
      error: null,
      status: 200,
    });

    renderPage();
    await screen.findByText("Alpha GmbH");
    const getCallsBeforeDelete = apiGet.mock.calls.length;

    // open the confirmation dialog via the row's delete button
    fireEvent.click(screen.getByRole("button", { name: "common.delete" }));
    expect(
      await screen.findByText("sponsors.confirmDeleteTitle")
    ).toBeInTheDocument();

    // confirm: the dialog's delete button is the last "common.delete" button
    const deleteButtons = screen.getAllByRole("button", {
      name: "common.delete",
    });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);

    await waitFor(() =>
      expect(apiDelete).toHaveBeenCalledWith(
        "/api/v1/sponsors/11111111-1111-1111-1111-111111111111"
      )
    );
    // list refreshes after delete (an extra GET fires)
    await waitFor(() =>
      expect(apiGet.mock.calls.length).toBeGreaterThan(getCallsBeforeDelete)
    );
  });

  it("renders the row delete affordance as visibly destructive (A76 — destructive class survives the refactor)", async () => {
    apiGet.mockResolvedValue({
      data: [SPONSORS[0]],
      error: null,
      status: 200,
    });

    renderPage();
    await screen.findByText("Alpha GmbH");

    const deleteButton = screen.getByRole("button", { name: "common.delete" });
    // current god-page uses text-red-600; the refactor must keep a destructive
    // affordance (red text class OR the destructive token variant). Asserting the
    // affordance is distinct guards the E21 P2 regression class.
    expect(deleteButton.className).toMatch(/red|destructive/);
  });

  it("A76: a failed delete surfaces the error AND does not wipe the list", async () => {
    apiGet.mockResolvedValue({
      data: [SPONSORS[0]],
      error: null,
      status: 200,
    });
    apiDelete.mockResolvedValue({
      data: null,
      error: "Delete failed",
      status: 500,
    });

    renderPage();
    await screen.findByText("Alpha GmbH");

    fireEvent.click(screen.getByRole("button", { name: "common.delete" }));
    const deleteButtons = await screen.findAllByRole("button", {
      name: "common.delete",
    });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);

    // delete error is visible (not swallowed)
    expect(await screen.findByText("Delete failed")).toBeInTheDocument();
    // and the row is still present (the list was not cleared)
    expect(screen.getByText("Alpha GmbH")).toBeInTheDocument();
  });
});
