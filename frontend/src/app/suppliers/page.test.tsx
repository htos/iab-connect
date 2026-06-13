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
 * E21-S2: Characterization tests for the Suppliers list page (REQ-032).
 *
 * Pins the CURRENT observable behaviour of `frontend/src/app/suppliers/page.tsx`
 * BEFORE the E21-S3 feature-slice refactor, so that refactor is provably
 * behaviour-preserving (Gate-1 CF-5: no Suppliers test exists today).
 *
 * These tests assert the OBSERVABLE surface — what the DOM renders and which
 * `useApiClient` calls fire — NOT internals (`useState`/`startTransition`) that
 * the refactor will legitimately change. The current quirks are pinned on
 * purpose: status filter is SERVER-side (`?status=`), search is CLIENT-side.
 *
 * Mock fidelity note: the real `useApiClient`/`useRouter` return memoized,
 * STABLE objects, and the page puts `api` in its `fetchSuppliers` dependency
 * chain. The mocks below therefore return stable references — a fresh object
 * per render would make the fetch effect re-fire on every render.
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

// next/link: render a real anchor so href is observable (a passthrough that
// drops href would defeat the detail/edit-link assertions).
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
const authState = { isAuthenticated: true, isLoading: false, isAdmin: true };
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => apiClient,
}));

import SuppliersPage from "./page";

const SUPPLIERS = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    companyName: "Alpha GmbH",
    contactPerson: "Anna Alpha",
    email: "anna@alpha.example",
    category: "Catering",
    status: "Active",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    companyName: "Beta AG",
    contactPerson: "Bert Beta",
    email: "bert@beta.example",
    category: "Printing",
    status: "Prospect",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.isAdmin = true;
  apiGet.mockResolvedValue({ data: SUPPLIERS, error: null, status: 200 });
  apiDelete.mockResolvedValue({ data: null, error: null, status: 204 });
});

afterEach(cleanup);

// E21-S3 seam: the page now uses TanStack Query, so it must render inside a
// QueryClientProvider. A fresh client with retries off keeps the suite
// deterministic. This is a test-harness seam change only — the behaviour
// assertions below are unchanged.
function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SuppliersPage />
    </QueryClientProvider>
  );
}

describe("SuppliersPage — characterization (current behaviour)", () => {
  it("redirects unauthenticated users to /login and does not fetch", async () => {
    authState.isAuthenticated = false;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("redirects authenticated non-admins to / and does not fetch", async () => {
    authState.isAuthenticated = true;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("loads suppliers for an admin and renders a row per supplier", async () => {
    renderPage();

    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith("/api/v1/suppliers")
    );
    expect(await screen.findByText("Alpha GmbH")).toBeInTheDocument();
    expect(screen.getByText("Beta AG")).toBeInTheDocument();
  });

  it("renders detail and edit links with the correct hrefs", async () => {
    apiGet.mockResolvedValue({
      data: [SUPPLIERS[0]],
      error: null,
      status: 200,
    });

    renderPage();

    const detail = await screen.findByRole("link", { name: "Alpha GmbH" });
    expect(detail).toHaveAttribute(
      "href",
      "/suppliers/11111111-1111-1111-1111-111111111111"
    );
    const edit = screen.getByRole("link", { name: "common.edit" });
    expect(edit).toHaveAttribute(
      "href",
      "/suppliers/11111111-1111-1111-1111-111111111111/edit"
    );
  });

  it("applies the status filter server-side (re-fetch with ?status=)", async () => {
    renderPage();
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith("/api/v1/suppliers")
    );

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Active" },
    });

    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith("/api/v1/suppliers?status=Active")
    );
  });

  it("filters search client-side without an extra fetch", async () => {
    renderPage();
    await screen.findByText("Alpha GmbH");
    const callsAfterLoad = apiGet.mock.calls.length;

    fireEvent.change(
      screen.getByPlaceholderText("suppliers.searchPlaceholder"),
      { target: { value: "Beta" } }
    );

    await waitFor(() =>
      expect(screen.queryByText("Alpha GmbH")).not.toBeInTheDocument()
    );
    expect(screen.getByText("Beta AG")).toBeInTheDocument();
    // search is purely client-side: no additional GET fired
    expect(apiGet.mock.calls.length).toBe(callsAfterLoad);
  });

  it("shows the empty state when no suppliers are returned", async () => {
    apiGet.mockResolvedValue({ data: [], error: null, status: 200 });

    renderPage();

    expect(await screen.findByText("suppliers.empty")).toBeInTheDocument();
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
      data: [SUPPLIERS[0]],
      error: null,
      status: 200,
    });

    renderPage();
    await screen.findByText("Alpha GmbH");
    const getCallsBeforeDelete = apiGet.mock.calls.length;

    // open the confirmation dialog via the row's delete button
    fireEvent.click(screen.getByRole("button", { name: "common.delete" }));
    expect(
      await screen.findByText("suppliers.confirmDeleteTitle")
    ).toBeInTheDocument();

    // confirm: the dialog's delete button is the last "common.delete" button
    const deleteButtons = screen.getAllByRole("button", {
      name: "common.delete",
    });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);

    await waitFor(() =>
      expect(apiDelete).toHaveBeenCalledWith(
        "/api/v1/suppliers/11111111-1111-1111-1111-111111111111"
      )
    );
    // list refreshes after delete (an extra GET fires)
    await waitFor(() =>
      expect(apiGet.mock.calls.length).toBeGreaterThan(getCallsBeforeDelete)
    );
  });

  it("surfaces a failed delete in the error banner and clears it on the next filter change (P3 regression)", async () => {
    apiGet.mockResolvedValue({
      data: [SUPPLIERS[0]],
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

    // changing the status filter clears the stale delete error
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Active" },
    });
    await waitFor(() =>
      expect(screen.queryByText("Delete failed")).not.toBeInTheDocument()
    );
  });
});
