// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * E25-S1: Characterization tests for the Automations LIST god-page
 * (REQ-028, src/app/communication/automations/page.tsx) BEFORE the later
 * feature-slice refactor. Pins the CURRENT observable behaviour at HEAD.
 *
 * HEAD quirks pinned here:
 *  - Auth guard: unauthenticated → push("/login"); authenticated-but-not-
 *    (Vorstand||Admin) → push("/"). listAutomations is NOT called when
 *    unauthorized, and is gated on `accessToken && (isVorstand || isAdmin)`.
 *  - Initial query args: listAutomations(token, { page:1, pageSize:10,
 *    status: undefined }). `search` is NEVER sent to the server — search is
 *    client-side via useMemo over name/templateName.
 *  - Status-filter change resets page→1 and refetches with status=<value>.
 *  - Pagination block only renders when totalPages > 1.
 *  - loading|error|empty states; status badge + trigger label via helpers.
 *
 * Assert via i18n KEYS (identity translator), ARIA roles, service-fn ARGS and
 * navigation (push) — never display copy. The render is wrapped in a fresh
 * QueryClientProvider (forward-compat seam) though the page does not yet use
 * TanStack.
 */

// next-intl: STABLE identity translator (A64). The page passes t into
// fetchAutomations' deps, so a stable t avoids an effect-loop surprise.
vi.mock("next-intl", () => {
  const translate = (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key;
  return { useTranslations: () => translate };
});

// next/navigation: stable router so push() is assertable.
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));

// @/lib/auth: configurable, STABLE auth state (A64/A78 — define once, mutate
// per test in beforeEach). The page destructures isAuthenticated, isLoading
// (as authLoading), isVorstand, isAdmin, accessToken.
const authState = {
  isAuthenticated: true,
  isLoading: false,
  isVorstand: true,
  isAdmin: false,
  accessToken: "test-token" as string | null,
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
}));

// @/features/communication/automations/api/automations: override only the fetch fn; keep the real helpers
// (getStatusColor/getTriggerLabel) so badge colour + trigger label behave as
// at HEAD.
const listAutomations = vi.fn();
vi.mock("@/features/communication/automations/api/automations", async () => {
  const actual = await vi.importActual<typeof import("@/features/communication/automations/api/automations")>(
    "@/features/communication/automations/api/automations"
  );
  return {
    ...actual,
    listAutomations: (...args: unknown[]) => listAutomations(...args),
  };
});

import AutomationsPage from "./page";

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "auto-1",
    name: "Welcome journey",
    status: "Draft",
    trigger: { type: "MemberJoined", offsetDays: null },
    templateId: 1,
    templateName: "Welcome template",
    segmentType: "AllActiveMembers",
    consentFilter: null,
    createdByName: "tester",
    createdAt: "2026-06-06T10:00:00Z",
    updatedAt: null,
    ...overrides,
  };
}

let listPayload: {
  items: ReturnType<typeof makeItem>[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
let listReject: boolean;

function listCalls() {
  return listAutomations.mock.calls;
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.isVorstand = true;
  authState.isAdmin = false;
  authState.accessToken = "test-token";

  listPayload = {
    items: [makeItem()],
    totalCount: 1,
    page: 1,
    pageSize: 10,
    totalPages: 1,
  };
  listReject = false;

  listAutomations.mockImplementation(() =>
    listReject
      ? Promise.reject(new Error("boom"))
      : Promise.resolve(listPayload)
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
      <AutomationsPage />
    </QueryClientProvider>
  );
}

describe("AutomationsPage — characterization (current behaviour)", () => {
  // --- auth guard ---

  it("redirects an unauthenticated user to /login and fires no list fetch", async () => {
    authState.isAuthenticated = false;
    authState.isVorstand = false;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(listAutomations).not.toHaveBeenCalled();
  });

  it("redirects an authenticated non-privileged user to / and fires no list fetch", async () => {
    authState.isAuthenticated = true;
    authState.isVorstand = false;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(listAutomations).not.toHaveBeenCalled();
  });

  it("shows the loading spinner while auth is still loading and does not redirect", () => {
    authState.isLoading = true;

    const { container } = renderPage();

    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    // The redirect effect is guarded by !authLoading, so no redirect fires.
    expect(push).not.toHaveBeenCalled();
  });

  it("loads the list for a Vorstand-only user", async () => {
    renderPage();

    await waitFor(() => expect(listAutomations).toHaveBeenCalled());
    expect(await screen.findByText("Welcome journey")).toBeInTheDocument();
  });

  it("loads the list for an Admin-only user", async () => {
    authState.isVorstand = false;
    authState.isAdmin = true;

    renderPage();

    await waitFor(() => expect(listAutomations).toHaveBeenCalled());
    expect(await screen.findByText("Welcome journey")).toBeInTheDocument();
  });

  it("does not fetch when there is no access token", async () => {
    authState.accessToken = null;

    renderPage();

    // give effects a tick to settle
    await waitFor(() => expect(push).not.toHaveBeenCalledWith("/login"));
    expect(listAutomations).not.toHaveBeenCalled();
  });

  // --- initial query args ---

  it("requests the first page with page=1, pageSize=10 and undefined status", async () => {
    renderPage();

    await waitFor(() => expect(listAutomations).toHaveBeenCalled());
    expect(listCalls()[0][0]).toBe("test-token");
    const args = listCalls()[0][1] as Record<string, unknown>;
    expect(args.page).toBe(1);
    expect(args.pageSize).toBe(10);
    expect(args.status).toBeUndefined();
  });

  // --- server status filter (resets page → 1) ---

  it("changing the status filter resets page→1 and refetches with status=", async () => {
    renderPage();
    await screen.findByText("Welcome journey");
    const before = listCalls().length;

    // the only combobox on the page is the status filter
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Active" },
    });

    await waitFor(() => expect(listCalls().length).toBeGreaterThan(before));
    const args = listCalls().at(-1)![1] as Record<string, unknown>;
    expect(args.status).toBe("Active");
    expect(args.page).toBe(1);
  });

  // --- client-side search (useMemo over name/templateName) ---

  it("filters the rendered rows client-side by name without refetching", async () => {
    listPayload.items = [
      makeItem({ id: "a", name: "Welcome journey" }),
      makeItem({ id: "b", name: "Renewal reminder", templateName: "Renewal" }),
    ];

    renderPage();
    await screen.findByText("Welcome journey");
    const before = listCalls().length;

    fireEvent.change(screen.getByPlaceholderText("search"), {
      target: { value: "renewal" },
    });

    await waitFor(() =>
      expect(screen.queryByText("Welcome journey")).not.toBeInTheDocument()
    );
    expect(screen.getByText("Renewal reminder")).toBeInTheDocument();
    // client-side only — no extra server fetch
    expect(listCalls().length).toBe(before);
  });

  it("client-side search also matches on templateName", async () => {
    listPayload.items = [
      makeItem({ id: "a", name: "Welcome journey", templateName: "Welcome" }),
      makeItem({ id: "b", name: "Other", templateName: "Birthday blast" }),
    ];

    renderPage();
    await screen.findByText("Welcome journey");

    fireEvent.change(screen.getByPlaceholderText("search"), {
      target: { value: "birthday" },
    });

    await waitFor(() =>
      expect(screen.queryByText("Welcome journey")).not.toBeInTheDocument()
    );
    expect(screen.getByText("Other")).toBeInTheDocument();
  });

  // --- table render: status badge + trigger label + detail/new links ---

  it("renders a status badge and trigger label for each row", async () => {
    listPayload.items = [makeItem({ status: "Active" })];

    renderPage();
    await screen.findByText("Welcome journey");

    // The status badge text (t(`status${status}`)) lives in the table; the same
    // key also appears as a filter <option>, so scope to the table to assert
    // the badge specifically.
    const table = screen.getByRole("table");
    expect(within(table).getByText("statusActive")).toBeInTheDocument();
    // trigger label via getTriggerLabel(t) — MemberJoined → triggerLabel.memberJoined
    expect(
      within(table).getByText("triggerLabel.memberJoined")
    ).toBeInTheDocument();
  });

  it("links each row name to its detail page and exposes the New link", async () => {
    renderPage();
    await screen.findByText("Welcome journey");

    const detailLink = screen.getByRole("link", { name: "Welcome journey" });
    expect(detailLink).toHaveAttribute(
      "href",
      "/communication/automations/auto-1"
    );

    const newLink = screen.getByRole("link", { name: "newAutomation" });
    expect(newLink).toHaveAttribute("href", "/communication/automations/new");
  });

  // --- empty + error states ---

  it("renders the empty state when no automations are returned", async () => {
    listPayload.items = [];
    listPayload.totalCount = 0;

    renderPage();

    expect(await screen.findByText("noAutomationsFound")).toBeInTheDocument();
  });

  it("surfaces loadError when the list load rejects", async () => {
    listReject = true;

    renderPage();

    expect(await screen.findByText("loadError")).toBeInTheDocument();
  });

  // --- pagination ---

  it("does not render pagination when totalPages === 1", async () => {
    renderPage();
    await screen.findByText("Welcome journey");

    expect(screen.queryByText("previous")).not.toBeInTheDocument();
    expect(screen.queryByText("next")).not.toBeInTheDocument();
  });

  it("renders pagination with Prev disabled at page 1 when totalPages > 1", async () => {
    listPayload.totalPages = 3;
    listPayload.totalCount = 25;

    renderPage();
    await screen.findByText("Welcome journey");

    expect(screen.getByText("previous")).toBeDisabled();
    expect(screen.getByText("next")).toBeEnabled();
  });

  it("clicking Next refetches with the incremented page", async () => {
    listPayload.totalPages = 3;
    listPayload.totalCount = 25;

    renderPage();
    await screen.findByText("Welcome journey");
    const before = listCalls().length;

    fireEvent.click(screen.getByText("next"));

    await waitFor(() => expect(listCalls().length).toBeGreaterThan(before));
    const args = listCalls().at(-1)![1] as Record<string, unknown>;
    expect(args.page).toBe(2);
  });
});
