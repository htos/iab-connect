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
 * E23-S1 characterization tests for the Members DUPLICATES page (REQ-018, E2.S4),
 * transport layer updated for the E23-S3 feature-slice migration (licensed A79
 * mechanism update).
 *
 * The page now flows through the slice's TanStack hooks
 * (useDuplicateGroups / useMergeMembers / useDismissDuplicates), which call the
 * duplicate endpoints via `useApiClient()` — NOT the `@/lib/api/members`
 * standalone fns. So we mock `@/lib/auth` (stable `useAuth` + an `useApiClient`
 * whose `{get,post,...}` are vi.fn()s) and assert on those transport spies. The
 * relocated REAL Radix modals + DuplicateGroupRow (which still import the REAL
 * `parseMatchReason`/types from `@/lib/api/members`) are rendered.
 *
 * The observable surface — DOM (data-testids) + which endpoints fire (and with
 * what args) — is preserved verbatim from S1.
 *
 * LOAD-BEARING (AC-9): cascade-dismiss issues ONE POST to
 * /api/v1/members/duplicate-dismissals per canonical pair = C(N,2). For a
 * 3-member group that is exactly 3.
 */

vi.mock("next-intl", () => {
  const translate = (key: string) => key;
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

// Stable auth state (A64) — mutated per-test before render.
const authState = {
  isAuthenticated: true,
  isLoading: false,
  isVorstand: false,
  isAdmin: true,
  accessToken: "test-token",
};

// Transport spies — the slice hooks consume these via useApiClient().
const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPut = vi.fn();
const apiDelete = vi.fn();
const apiUpload = vi.fn();
const apiClient = {
  get: apiGet,
  post: apiPost,
  put: apiPut,
  delete: apiDelete,
  upload: apiUpload,
};

vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => apiClient,
}));

import {
  type DuplicateGroupDto,
  type DuplicateCandidateDto,
} from "@/lib/api/members";
import DuplicatesPage from "./page";

function makeCandidate(
  overrides: Partial<DuplicateCandidateDto> = {}
): DuplicateCandidateDto {
  return {
    id: "m-1",
    firstName: "Anna",
    lastName: "Muster",
    email: "anna@example.com",
    membershipStatus: "Active",
    memberSince: "2020-01-01",
    matchTier: "Exact",
    matchReason: "Email",
    ...overrides,
  };
}

function makeGroup(
  memberCount: number,
  overrides: Partial<DuplicateGroupDto> = {}
): DuplicateGroupDto {
  const members = Array.from({ length: memberCount }, (_, i) =>
    makeCandidate({
      id: `m-${i + 1}`,
      firstName: `First${i + 1}`,
      lastName: `Last${i + 1}`,
      email: `member${i + 1}@example.com`,
    })
  );
  return {
    groupKey: "group-key-1",
    tier: "Exact",
    members,
    ...overrides,
  };
}

// useApiClient().get returns the shared `{ data, error, status }` envelope.
function pagedEnvelope(groups: DuplicateGroupDto[], totalPages = 1) {
  return {
    data: {
      items: groups,
      totalCount: groups.length,
      page: 1,
      pageSize: 20,
      totalPages,
      hasNextPage: totalPages > 1,
      hasPreviousPage: false,
    },
    error: null,
    status: 200,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.isVorstand = false;
  authState.isAdmin = true;
  authState.accessToken = "test-token";
  apiGet.mockResolvedValue(pagedEnvelope([makeGroup(2)]));
  apiPost.mockResolvedValue({
    data: {
      targetId: "m-1",
      sourceId: "m-2",
      movedReferences: {},
      auditEventId: "audit-1",
      dismissalId: "d-1",
      sourceMemberId: "m-1",
      targetMemberId: "m-2",
      created: true,
    },
    error: null,
    status: 200,
  });
});

afterEach(cleanup);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DuplicatesPage />
    </QueryClientProvider>
  );
}

describe("DuplicatesPage — characterization (current behaviour)", () => {
  // --- Auth guards (AC-2) ---

  it("redirects unauthenticated users to /login", async () => {
    authState.isAuthenticated = false;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("redirects authenticated users who are neither Vorstand nor Admin to /", async () => {
    authState.isAuthenticated = true;
    authState.isVorstand = false;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(apiGet).not.toHaveBeenCalled();
  });

  // --- Load / list (AC-11 testids) ---

  it("fetches and renders the duplicates list with one group row", async () => {
    renderPage();

    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    expect(await screen.findByTestId("duplicates-list")).toBeInTheDocument();
    expect(
      screen.getByTestId("duplicate-group-group-key-1")
    ).toBeInTheDocument();
    // Fetched against the duplicate-groups endpoint with default page/pageSize.
    const url = apiGet.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/members/duplicate-groups");
    expect(url).toContain("page=1");
    expect(url).toContain("pageSize=20");
    // No minTier param when the filter is "all".
    expect(url).not.toContain("minTier");
  });

  it("shows the loading state while the fetch is pending", async () => {
    apiGet.mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(await screen.findByTestId("duplicates-loading")).toBeInTheDocument();
  });

  it("shows the error state with a retry button when the fetch rejects", async () => {
    apiGet.mockResolvedValueOnce({ data: null, error: "Boom", status: 500 });

    renderPage();

    const errorBox = await screen.findByTestId("duplicates-error");
    expect(errorBox).toBeInTheDocument();
    expect(within(errorBox).getByText("Boom")).toBeInTheDocument();

    // Retry re-fetches (query refetch).
    apiGet.mockResolvedValueOnce(pagedEnvelope([makeGroup(2)]));
    fireEvent.click(
      within(errorBox).getByText("members.duplicates.error.retry")
    );
    await waitFor(() => expect(apiGet.mock.calls.length).toBeGreaterThan(1));
  });

  it("shows the empty state when there are no duplicate groups", async () => {
    apiGet.mockResolvedValue(pagedEnvelope([]));

    renderPage();

    expect(await screen.findByTestId("duplicates-empty")).toBeInTheDocument();
  });

  // --- Tier filter (AC-3) ---

  it("re-fetches with the new minTier (and resets to page 1) on tier-filter change", async () => {
    renderPage();
    await screen.findByTestId("duplicates-list");

    const filter = screen.getByTestId("duplicates-tier-filter");
    fireEvent.change(filter, { target: { value: "Likely" } });

    await waitFor(() => {
      const calledWithLikely = apiGet.mock.calls.some((c) => {
        const url = c[0] as string;
        return (
          url.includes("/api/v1/members/duplicate-groups") &&
          url.includes("minTier=Likely") &&
          url.includes("page=1")
        );
      });
      expect(calledWithLikely).toBe(true);
    });
  });

  // --- Admin gating of Merge (AC-7) ---

  it("renders the Merge button DISABLED with the admin-only title for a Vorstand-but-not-Admin user", async () => {
    authState.isVorstand = true;
    authState.isAdmin = false;

    renderPage();
    await screen.findByTestId("duplicates-list");

    const mergeBtn = screen.getByTestId("duplicate-group-merge");
    expect(mergeBtn).toBeDisabled();
    expect(mergeBtn).toHaveAttribute(
      "title",
      "members.duplicates.mergeAdminOnly"
    );
    // Dismiss remains available to Vorstand+.
    expect(screen.getByTestId("duplicate-group-dismiss")).toBeEnabled();
  });

  it("enables the Merge button for an Admin", async () => {
    renderPage();
    await screen.findByTestId("duplicates-list");

    expect(screen.getByTestId("duplicate-group-merge")).toBeEnabled();
  });

  // --- Modals open (AC-7) ---

  it("opens the MergeConfirmationModal when Merge is clicked", async () => {
    renderPage();
    await screen.findByTestId("duplicates-list");

    fireEvent.click(screen.getByTestId("duplicate-group-merge"));

    expect(
      await screen.findByTestId("merge-confirmation-modal")
    ).toBeInTheDocument();
  });

  it("opens the DismissConfirmationModal when Dismiss is clicked", async () => {
    renderPage();
    await screen.findByTestId("duplicates-list");

    fireEvent.click(screen.getByTestId("duplicate-group-dismiss"));

    expect(
      await screen.findByTestId("dismiss-confirmation-modal")
    ).toBeInTheDocument();
  });

  // --- Merge confirm posts the request + refetches (AC-7) ---

  it("merge confirm posts {reason, confirmFinanceImpact, confirmKeycloakImpact} and refetches", async () => {
    renderPage();
    await screen.findByTestId("duplicates-list");

    const initialGetCalls = apiGet.mock.calls.length;

    fireEvent.click(screen.getByTestId("duplicate-group-merge"));
    const modal = await screen.findByTestId("merge-confirmation-modal");

    // 2-member group: pick the target radio (source is auto-derived).
    fireEvent.click(within(modal).getByTestId("merge-target-m-1"));
    fireEvent.change(within(modal).getByTestId("merge-reason-input"), {
      target: { value: "same person" },
    });
    fireEvent.click(within(modal).getByTestId("merge-confirm-finance"));
    fireEvent.click(within(modal).getByTestId("merge-confirm-keycloak"));

    fireEvent.click(within(modal).getByTestId("merge-submit"));

    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1));
    // POST /api/v1/members/{src}/merge-into/{tgt} with the merge body.
    expect(apiPost).toHaveBeenCalledWith("/api/v1/members/m-2/merge-into/m-1", {
      reason: "same person",
      confirmFinanceImpact: true,
      confirmKeycloakImpact: true,
    });
    // onSuccess invalidation -> refetch.
    await waitFor(() =>
      expect(apiGet.mock.calls.length).toBeGreaterThan(initialGetCalls)
    );
  });

  // --- LOAD-BEARING: cascade-dismiss C(N,2) (AC-9) ---

  it("cascade-dismiss issues exactly C(N,2)=3 POSTs to duplicate-dismissals for a 3-member group, then refetches", async () => {
    apiGet.mockResolvedValue(pagedEnvelope([makeGroup(3)]));

    renderPage();
    await screen.findByTestId("duplicates-list");

    const initialGetCalls = apiGet.mock.calls.length;

    fireEvent.click(screen.getByTestId("duplicate-group-dismiss"));
    const modal = await screen.findByTestId("dismiss-confirmation-modal");
    fireEvent.change(within(modal).getByTestId("dismiss-reason-input"), {
      target: { value: "not duplicates" },
    });
    fireEvent.click(within(modal).getByTestId("dismiss-submit"));

    // C(3,2) = 3 POSTs, one per canonical pair, in one action (Promise.all).
    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(3));

    // Every POST targets the dismissals endpoint.
    for (const call of apiPost.mock.calls) {
      expect(call[0]).toBe("/api/v1/members/duplicate-dismissals");
    }

    // The three emitted canonical pairs are (1,2), (1,3), (2,3).
    const pairs = apiPost.mock.calls.map((c) => ({
      memberA: (c[1] as { memberA: string }).memberA,
      memberB: (c[1] as { memberB: string }).memberB,
      reason: (c[1] as { reason: string }).reason,
    }));
    expect(pairs).toEqual([
      { memberA: "m-1", memberB: "m-2", reason: "not duplicates" },
      { memberA: "m-1", memberB: "m-3", reason: "not duplicates" },
      { memberA: "m-2", memberB: "m-3", reason: "not duplicates" },
    ]);

    // Successful confirm invalidates -> refetch.
    await waitFor(() =>
      expect(apiGet.mock.calls.length).toBeGreaterThan(initialGetCalls)
    );
  });

  it("cascade-dismiss issues exactly C(2,2)=1 POST for a 2-member group", async () => {
    renderPage();
    await screen.findByTestId("duplicates-list");

    fireEvent.click(screen.getByTestId("duplicate-group-dismiss"));
    const modal = await screen.findByTestId("dismiss-confirmation-modal");
    fireEvent.change(within(modal).getByTestId("dismiss-reason-input"), {
      target: { value: "false positive" },
    });
    fireEvent.click(within(modal).getByTestId("dismiss-submit"));

    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1));
    expect(apiPost).toHaveBeenCalledWith(
      "/api/v1/members/duplicate-dismissals",
      {
        memberA: "m-1",
        memberB: "m-2",
        reason: "false positive",
      }
    );
  });
});
