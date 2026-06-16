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
 * E23-S1: Characterization tests for the Member SEGMENT DETAIL page (REQ-017).
 *
 * Pins the CURRENT observable behaviour of
 * `frontend/src/app/members/segments/[id]/page.tsx` BEFORE the E23 members
 * feature-slice refactor. The page is a `useApiClient` (`{data,error,status}`)
 * consumer, NOT yet a TanStack consumer — but renders are still wrapped in a
 * fresh `QueryClientProvider` to match the harness used across the refactor.
 *
 * Asserts the observable surface — DOM + which `useApiClient` calls fire — not
 * internals. Auth guard allows Admin OR Vorstand; the destructive delete control
 * is Admin-only. The add-member typeahead is debounced (300ms, min 2 chars), so
 * those tests drive fake timers.
 *
 * HEAD QUIRK pinned below: when the segment GET returns an *error*, `segment`
 * stays null and `loading` is set false, so the page renders the generic
 * `segments.notFound` state — the error string is never shown for the initial
 * segment load (there is no error-banner path on first render).
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
  isVorstand: false,
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => apiClient,
}));

import SegmentDetailPage from "./page";

const SEGMENT_ID = "11111111-1111-1111-1111-111111111111";
const SEGMENT_URL = `/api/v1/member-segments/${SEGMENT_ID}`;
const MEMBERS_URL = `${SEGMENT_URL}/members`;

function makeSegment(overrides: Record<string, unknown> = {}) {
  return {
    id: SEGMENT_ID,
    name: "Board Members",
    description: "The board",
    segmentType: "Static",
    criteriaJson: undefined,
    color: "orange",
    isActive: true,
    memberCount: 2,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeMember(overrides: Record<string, unknown> = {}) {
  return {
    id: "member-1",
    firstName: "Mia",
    lastName: "Member",
    email: "mia@example.com",
    status: "Active",
    membershipType: "Regular",
    memberSince: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makePagedMembers(items: ReturnType<typeof makeMember>[]) {
  return {
    items,
    totalCount: items.length,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  };
}

function makeSearchResult(overrides: Record<string, unknown> = {}) {
  return {
    id: "search-1",
    firstName: "Sara",
    lastName: "Search",
    email: "sara@example.com",
    ...overrides,
  };
}

/**
 * Resolve the api.get mock by URL: segment GET, members-list GET, member-search
 * GET each get their own payload. Tests override `searchResult` / others as
 * needed.
 */
function wireGet(opts: {
  segment?: { data: unknown; error: string | null; status: number };
  members?: { data: unknown; error: string | null; status: number };
  search?: { data: unknown; error: string | null; status: number };
}) {
  const segment = opts.segment ?? {
    data: makeSegment(),
    error: null,
    status: 200,
  };
  const members = opts.members ?? {
    data: makePagedMembers([makeMember()]),
    error: null,
    status: 200,
  };
  const search = opts.search ?? {
    data: { items: [makeSearchResult()], totalCount: 1 },
    error: null,
    status: 200,
  };
  apiGet.mockImplementation((url: string) => {
    if (url.startsWith("/api/v1/members?")) return Promise.resolve(search);
    if (url.startsWith(`${MEMBERS_URL}?`)) return Promise.resolve(members);
    if (url === SEGMENT_URL) return Promise.resolve(segment);
    return Promise.resolve({ data: null, error: null, status: 404 });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.isAdmin = true;
  authState.isVorstand = false;
  wireGet({});
  apiPost.mockResolvedValue({ data: null, error: null, status: 200 });
  apiDelete.mockResolvedValue({ data: null, error: null, status: 200 });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
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
      <SegmentDetailPage />
    </QueryClientProvider>
  );
}

describe("SegmentDetailPage — characterization (current behaviour)", () => {
  it("redirects unauthenticated users to /login", async () => {
    authState.isAuthenticated = false;
    authState.isAdmin = false;
    authState.isVorstand = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("redirects authenticated non-Admin non-Vorstand users to / (QUIRK: data still fetched)", async () => {
    authState.isAuthenticated = true;
    authState.isAdmin = false;
    authState.isVorstand = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    // QUIRK: the load effects guard only on isAuthenticated/!isLoading (NOT on
    // role), so the segment + members GETs still fire despite the redirect.
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith(SEGMENT_URL));
  });

  it("allows a Vorstand (non-Admin) user and loads the segment", async () => {
    authState.isAdmin = false;
    authState.isVorstand = true;

    renderPage();

    await waitFor(() => expect(apiGet).toHaveBeenCalledWith(SEGMENT_URL));
    expect(await screen.findByText("Board Members")).toBeInTheDocument();
  });

  it("loads the segment by id and its members list", async () => {
    renderPage();

    await waitFor(() => expect(apiGet).toHaveBeenCalledWith(SEGMENT_URL));
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith(`${MEMBERS_URL}?page=1&pageSize=20`)
    );
    expect(await screen.findByText("Mia Member")).toBeInTheDocument();
    expect(screen.getByText("mia@example.com")).toBeInTheDocument();
  });

  it("renders the not-found state when the segment GET returns 404 (no data)", async () => {
    wireGet({ segment: { data: null, error: null, status: 404 } });

    renderPage();

    expect(await screen.findByText("segments.notFound")).toBeInTheDocument();
  });

  it("QUIRK: a segment GET error still renders not-found (error string not shown)", async () => {
    wireGet({ segment: { data: null, error: "Boom", status: 500 } });

    renderPage();

    expect(await screen.findByText("segments.notFound")).toBeInTheDocument();
    expect(screen.queryByText("Boom")).not.toBeInTheDocument();
  });

  it("shows a loading spinner while the segment GET is pending", async () => {
    apiGet.mockImplementation((url: string) => {
      if (url === SEGMENT_URL) return new Promise(() => {});
      return Promise.resolve({
        data: makePagedMembers([makeMember()]),
        error: null,
        status: 200,
      });
    });

    const { container } = renderPage();

    await waitFor(() => expect(apiGet).toHaveBeenCalledWith(SEGMENT_URL));
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows the Admin-only delete control (two-step confirm) for Admins", async () => {
    renderPage();
    await screen.findByText("Board Members");

    expect(
      screen.getByRole("button", { name: "common.delete" })
    ).toBeInTheDocument();
  });

  it("hides the delete control for a Vorstand-only (non-Admin) user", async () => {
    authState.isAdmin = false;
    authState.isVorstand = true;

    renderPage();
    await screen.findByText("Board Members");

    expect(
      screen.queryByRole("button", { name: "common.delete" })
    ).not.toBeInTheDocument();
  });

  it("deletes the segment (after confirm) and redirects to /members/segments", async () => {
    renderPage();
    await screen.findByText("Board Members");

    fireEvent.click(screen.getByRole("button", { name: "common.delete" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "common.confirm" })
    );

    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith(SEGMENT_URL));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/members/segments"));
  });

  it("populates the typeahead after a debounced search and adds a member via POST", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    renderPage();
    await screen.findByText("Board Members");

    const input = screen.getByPlaceholderText(
      "segments.searchMemberPlaceholder"
    );
    fireEvent.change(input, { target: { value: "sar" } });

    // Debounce window (300ms) — no search before it elapses.
    expect(apiGet).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/members?")
    );
    await vi.advanceTimersByTimeAsync(300);

    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/members?search=sar")
      )
    );
    const candidate = await screen.findByText("Sara Search");

    fireEvent.click(candidate);

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(MEMBERS_URL, {
        memberId: "search-1",
      })
    );
    // A successful add bumps refreshKey -> segment refetched (>1 segment GET).
    await waitFor(() =>
      expect(
        apiGet.mock.calls.filter((c) => c[0] === SEGMENT_URL).length
      ).toBeGreaterThan(1)
    );
  });

  it("does not search for queries shorter than 2 characters", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    renderPage();
    await screen.findByText("Board Members");

    fireEvent.change(
      screen.getByPlaceholderText("segments.searchMemberPlaceholder"),
      { target: { value: "s" } }
    );
    await vi.advanceTimersByTimeAsync(300);

    expect(apiGet).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/members?")
    );
  });

  it("removes a member (after confirm) via DELETE and bumps the refresh", async () => {
    renderPage();
    await screen.findByText("Mia Member");

    fireEvent.click(
      screen.getByRole("button", { name: "segments.action.remove" })
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "common.confirm" })
    );

    await waitFor(() =>
      expect(apiDelete).toHaveBeenCalledWith(`${MEMBERS_URL}/member-1`)
    );
    await waitFor(() =>
      expect(
        apiGet.mock.calls.filter((c) => c[0] === SEGMENT_URL).length
      ).toBeGreaterThan(1)
    );
  });

  it("does not show add/remove member controls for a Dynamic segment", async () => {
    wireGet({
      segment: {
        data: makeSegment({ segmentType: "Dynamic" }),
        error: null,
        status: 200,
      },
    });

    renderPage();
    await screen.findByText("Board Members");

    expect(
      screen.queryByPlaceholderText("segments.searchMemberPlaceholder")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "segments.action.remove" })
    ).not.toBeInTheDocument();
  });
});
