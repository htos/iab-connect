// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// E24-S2: Behaviour-preserving regression net for the Events LIST god-page
// (REQ-019), repointed to the feature-slice transport.
//
// The route now renders `@/features/events` `EventsPageContent`, which uses
// `useApiClient()` ({data,error,status}) + TanStack Query instead of raw `fetch`.
// Every behavioural assertion from the E24-S1 characterization suite is preserved
// verbatim; only the TRANSPORT mechanism assertions change:
//   - `vi.stubGlobal("fetch", …)` + fetch-URL/Authorization-header assertions
//     → `apiGet.mockResolvedValue(...)` + `apiGet` endpoint-string assertions
//     (no localhost prefix — useApiClient adds the base; the Authorization header
//     is now the client's concern, not the page's, so that assertion is dropped).
//   - The two former error paths (`!response.ok` vs a thrown fetch) collapse into
//     ONE uniform `loadFailed` path: the hook turns `{ error }` into a thrown
//     Error → query error → the inline banner. Statistics errors stay SILENTLY
//     ignored (the cards simply do not render).
//
// Mocks return STABLE references (define once, mutate per test) so effects/query
// keys do not churn on identity changes.

// next-intl: identity translator (echo key, append vars JSON when present). MUST
// be a STABLE reference.
vi.mock("next-intl", () => {
  const translate = (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key;
  return { useTranslations: () => translate };
});

// next/navigation: a STABLE router object with a module-scope push spy.
const pushSpy = vi.fn();
const routerMock = {
  push: pushSpy,
  replace: vi.fn(),
  refresh: vi.fn(),
};
vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

// @/lib/auth: one STABLE auth state mutated per test + a STABLE spy api client
// ({data,error,status} — matches lib/auth.ts useApiClient).
type AuthState = {
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  isVorstand: boolean;
  isAdmin: boolean;
  roles: string[];
};

const authState: AuthState = {
  isAuthenticated: true,
  isLoading: false,
  accessToken: "test-token",
  isVorstand: true,
  isAdmin: false,
  roles: ["vorstand"],
};

function setAuth(patch: Partial<AuthState>) {
  Object.assign(authState, patch);
}

const apiGet = vi.fn();
const apiClient = {
  get: apiGet,
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  upload: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => apiClient,
}));

import EventsPage from "./page";

interface EventDto {
  id: string;
  title: string;
  description: string;
  shortDescription?: string;
  location: string;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  registrationRequired: boolean;
  waitlistEnabled: boolean;
  visibility: string;
  status: string;
  category: string;
  isFree: boolean;
  hasStarted: boolean;
  hasEnded: boolean;
  isRegistrationOpen: boolean;
}

function makeEvent(overrides: Partial<EventDto> = {}): EventDto {
  return {
    id: "evt-1",
    title: "Spring Gala",
    description: "A gala",
    shortDescription: "Gala",
    location: "Town Hall",
    startDate: "2026-07-01T18:00:00Z",
    endDate: "2026-07-01T21:00:00Z",
    isAllDay: false,
    registrationRequired: true,
    waitlistEnabled: false,
    visibility: "Public",
    status: "Published",
    category: "Social",
    isFree: false,
    hasStarted: false,
    hasEnded: false,
    isRegistrationOpen: true,
    ...overrides,
  };
}

interface PagedResponse {
  items: EventDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

function pagedResponse(
  items: EventDto[],
  overrides: Partial<PagedResponse> = {}
): PagedResponse {
  return {
    items,
    page: 1,
    pageSize: 12,
    totalCount: items.length,
    totalPages: 1,
    ...overrides,
  };
}

const statistics = {
  totalEvents: 9,
  upcomingEvents: 4,
  publishedEvents: 5,
  draftEvents: 2,
};

// Per-test overrides for the apiGet spy's behaviour.
let eventsPayload: PagedResponse;
let eventsError: string | null;
let statsOk: boolean;

// One apiGet spy branching by endpoint substring. The slice passes the endpoint
// string (page=1&pageSize=12 + non-empty filters only — no localhost prefix).
function configureApiGet() {
  apiGet.mockImplementation((endpoint: string) => {
    if (endpoint.includes("/events/statistics")) {
      return statsOk
        ? Promise.resolve({ data: statistics, error: undefined, status: 200 })
        : Promise.resolve({ data: undefined, error: "boom", status: 500 });
    }
    // events list
    return eventsError
      ? Promise.resolve({ data: undefined, error: eventsError, status: 500 })
      : Promise.resolve({ data: eventsPayload, error: undefined, status: 200 });
  });
}

// The list GET calls (endpoint has the events query string), excluding stats.
function eventListCalls() {
  return apiGet.mock.calls.filter(
    (c) => typeof c[0] === "string" && c[0].includes("/api/v1/events?")
  );
}

function statisticsCalls() {
  return apiGet.mock.calls.filter(
    (c) => typeof c[0] === "string" && c[0].includes("/events/statistics")
  );
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <EventsPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setAuth({
    isAuthenticated: true,
    isLoading: false,
    accessToken: "test-token",
    isVorstand: true,
    isAdmin: false,
    roles: ["vorstand"],
  });
  pushSpy.mockReset();

  eventsPayload = pagedResponse([makeEvent()]);
  eventsError = null;
  statsOk = true;
  configureApiGet();
});

afterEach(() => {
  cleanup();
});

describe("EventsPage — auth gating (AC2)", () => {
  it("renders the centred spinner while auth is loading and does not fetch", () => {
    setAuth({ isLoading: true });
    renderPage();
    // Loading copy from common.loading; no list call must fire.
    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(eventListCalls().length).toBe(0);
  });

  it("redirects unauthenticated users to /login and does not fetch", async () => {
    setAuth({ isAuthenticated: false, isLoading: false });
    renderPage();
    await waitFor(() => {
      expect(pushSpy).toHaveBeenCalledWith("/login");
    });
    expect(eventListCalls().length).toBe(0);
  });
});

describe("EventsPage — manager rendering + fetch endpoint (AC2, AC4)", () => {
  it("requests the initial page with page=1&pageSize=12 and no empty filter params", async () => {
    renderPage();
    await waitFor(() => {
      expect(eventListCalls().length).toBeGreaterThan(0);
    });
    const endpoint = eventListCalls()[0][0] as string;
    expect(endpoint).toEqual(
      expect.stringContaining("/api/v1/events?page=1&pageSize=12")
    );
    // Empty filters are NOT appended (god-page parity).
    expect(endpoint).not.toContain("search=");
    expect(endpoint).not.toContain("status=");
    expect(endpoint).not.toContain("category=");
  });

  it("renders events for a Vorstand manager", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Spring Gala")).toBeInTheDocument();
    });
  });

  it("renders events for an Admin manager", async () => {
    setAuth({ isVorstand: false, isAdmin: true, roles: ["admin"] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Spring Gala")).toBeInTheDocument();
    });
  });
});

describe("EventsPage — role-gated affordances (AC3)", () => {
  it("shows Create Event, status filter and statistics cards for a manager", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Spring Gala")).toBeInTheDocument();
    });
    // Create Event link (createEvent key) present.
    expect(screen.getAllByText("createEvent").length).toBeGreaterThan(0);
    // Status filter select (aria-label allStatuses) present.
    expect(
      screen.getByRole("combobox", { name: "allStatuses" })
    ).toBeInTheDocument();
    // Statistics cards rendered when payload present. (status.published also
    // appears as a filter <option> for managers, so assert via getAllByText.)
    await waitFor(() => {
      expect(screen.getAllByText("status.published").length).toBeGreaterThan(0);
    });
    // The 'total' stat-card label is unique to the statistics block.
    expect(screen.getByText("total")).toBeInTheDocument();
  });

  it("hides manager affordances for a plain authenticated non-manager", async () => {
    setAuth({ isVorstand: false, isAdmin: false, roles: ["member"] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Spring Gala")).toBeInTheDocument();
    });
    expect(screen.queryByText("createEvent")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "allStatuses" })
    ).not.toBeInTheDocument();
  });

  it("does not request statistics for a non-manager", async () => {
    setAuth({ isVorstand: false, isAdmin: false, roles: ["member"] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Spring Gala")).toBeInTheDocument();
    });
    expect(statisticsCalls().length).toBe(0);
  });
});

describe("EventsPage — statistics fetch (AC4)", () => {
  it("requests statistics for a manager", async () => {
    renderPage();
    await waitFor(() => {
      expect(statisticsCalls().length).toBeGreaterThan(0);
    });
  });

  it("silently ignores a statistics fetch error and still renders events", async () => {
    statsOk = false;
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Spring Gala")).toBeInTheDocument();
    });
    // No error banner — the page still shows events. Statistics cards absent.
    expect(screen.queryByText("errors.loadFailed")).not.toBeInTheDocument();
    expect(screen.queryByText("total")).not.toBeInTheDocument();
  });
});

describe("EventsPage — status colour map (AC5)", () => {
  const cases = [
    { status: "Draft", label: "status.draft", cls: "bg-gray-100" },
    { status: "Published", label: "status.published", cls: "bg-green-100" },
    { status: "Cancelled", label: "status.cancelled", cls: "bg-red-100" },
    { status: "Completed", label: "status.completed", cls: "bg-blue-100" },
  ];

  for (const { status, label, cls } of cases) {
    it(`renders the ${status} status badge with its colour class`, async () => {
      // Non-manager so the status filter select does not also emit status.* keys.
      setAuth({ isVorstand: false, isAdmin: false, roles: ["member"] });
      eventsPayload = pagedResponse([makeEvent({ status })]);
      renderPage();
      const badge = await screen.findByText(label);
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain(cls);
    });
  }
});

describe("EventsPage — pagination (AC9 boundary)", () => {
  it("disables Previous on page 1 and enables Next when totalPages > 1", async () => {
    eventsPayload = pagedResponse([makeEvent()], {
      totalPages: 3,
      totalCount: 30,
    });
    renderPage();
    const prev = await screen.findByRole("button", { name: "previous" });
    const next = await screen.findByRole("button", { name: "next" });
    expect(prev).toBeDisabled();
    expect(next).toBeEnabled();
  });

  it("does not render pagination when there is a single page", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Spring Gala")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: "previous" })
    ).not.toBeInTheDocument();
  });
});

describe("EventsPage — error + empty states (AC9)", () => {
  it("shows the loadFailed inline error banner when the events fetch errors", async () => {
    // Uniform via useApiClient: the hook turns `{ error }` into a thrown Error
    // → query error → the inline banner surfaces the error string.
    eventsError = "errors.loadFailed";
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("errors.loadFailed")).toBeInTheDocument();
    });
    // tryAgain affordance is part of the banner.
    expect(screen.getByText("tryAgain")).toBeInTheDocument();
  });

  it("shows the empty state when there are no events", async () => {
    eventsPayload = pagedResponse([]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("noEvents")).toBeInTheDocument();
    });
    expect(screen.getByText("noEventsDescription")).toBeInTheDocument();
  });
});

describe("EventsPage — view toggle (AC9)", () => {
  it("renders both grid and list view toggle buttons with grid pressed by default", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Spring Gala")).toBeInTheDocument();
    });
    const grid = screen.getByRole("button", { name: "gridView" });
    const list = screen.getByRole("button", { name: "listView" });
    expect(grid).toHaveAttribute("aria-pressed", "true");
    expect(list).toHaveAttribute("aria-pressed", "false");
  });
});
