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
 * E23-S2: Behaviour-preserving regression net for the Members LIST page
 * (REQ-016), repointed to the feature-slice transport.
 *
 * The page now renders `@/features/members` `MembersPageContent`, which uses
 * `useApiClient()` ({data,error,status}) + TanStack Query instead of raw
 * `fetch`, and an accessible Radix delete dialog instead of confirm()/alert().
 * The behavioural assertions from the E23-S1 characterization suite are
 * preserved verbatim; only the transport + delete MECHANISM assertions change:
 *   - `fetch(url)` → `apiClient.get(endpoint)` (assert the endpoint string).
 *   - DELETE fetch → `apiClient.delete(endpoint)`.
 *   - confirm()/alert() delete flow → open dialog, confirm, error in banner.
 *
 * Mocked hooks/clients return STABLE references (define once, mutate per test —
 * A64/A78) so effects/query keys do not churn on identity changes.
 */

// next-intl: one captured (stable) identity translator (A64).
vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

// next/navigation: stable router so push() is assertable.
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

// @/lib/auth: configurable, STABLE auth state + spyable, STABLE api client
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
  isVorstand: true,
  isAdmin: true,
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => apiClient,
}));

import MembersPage from "./page";

const MEMBERS = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    firstName: "Anna",
    lastName: "Alpha",
    email: "anna@alpha.example",
    city: "Zürich",
    membershipType: "Regular",
    membershipTypeDisplay: "Regular",
    status: "Active",
    statusDisplay: "Active",
    memberSince: "2020-01-15",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    firstName: "Bert",
    lastName: "Beta",
    email: "bert@beta.example",
    city: "Bern",
    membershipType: "Student",
    membershipTypeDisplay: "Student",
    status: "Pending",
    statusDisplay: "Pending",
    memberSince: "2021-06-01",
  },
];

const STATISTICS = {
  totalMembers: 2,
  activeMembers: 1,
  pendingMembers: 1,
  inactiveMembers: 0,
  suspendedMembers: 0,
  regularMembers: 1,
  studentMembers: 1,
  familyMembers: 0,
  honoraryMembers: 0,
};

// Per-test overrides for the apiGet mock's behaviour.
let membersPayload: {
  items: typeof MEMBERS;
  totalPages: number;
  totalCount: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};
let statisticsOk: boolean;
let membersError: string | null;

// A single apiGet mock branching by endpoint substring. Records each call so
// tests can assert the endpoint string (e.g. it includes page=1 & status=Active).
function configureApiGet() {
  apiGet.mockImplementation((endpoint: string) => {
    if (endpoint.includes("/api/v1/reports/export/members")) {
      return Promise.resolve({
        data: new Blob(["csv"]),
        error: null,
        status: 200,
      });
    }
    if (endpoint.includes("/api/v1/members/statistics")) {
      return statisticsOk
        ? Promise.resolve({ data: STATISTICS, error: null, status: 200 })
        : Promise.resolve({ data: null, error: "stats down", status: 500 });
    }
    if (endpoint.includes("/api/v1/members")) {
      return membersError
        ? Promise.resolve({ data: null, error: membersError, status: 500 })
        : Promise.resolve({ data: membersPayload, error: null, status: 200 });
    }
    return Promise.resolve({ data: null, error: null, status: 200 });
  });
}

// Helper: the list GET calls (the endpoint has a query string), excluding
// statistics/export.
function memberListCalls() {
  return apiGet.mock.calls.filter(
    (c) =>
      typeof c[0] === "string" &&
      c[0].includes("/api/v1/members?") &&
      !c[0].includes("/statistics")
  );
}

function statisticsCalls() {
  return apiGet.mock.calls.filter(
    (c) =>
      typeof c[0] === "string" && c[0].includes("/api/v1/members/statistics")
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.isVorstand = true;
  authState.isAdmin = true;

  membersPayload = {
    items: MEMBERS,
    totalPages: 1,
    totalCount: 2,
    page: 1,
    pageSize: 10,
    hasNextPage: false,
    hasPreviousPage: false,
  };
  statisticsOk = true;
  membersError = null;

  configureApiGet();
  apiDelete.mockResolvedValue({ data: null, error: null, status: 204 });

  // jsdom lacks these; the CSV export path touches them.
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:mock"),
      revokeObjectURL: vi.fn(),
    })
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
      <MembersPage />
    </QueryClientProvider>
  );
}

describe("MembersPage — behaviour-preserving (feature-slice transport)", () => {
  it("redirects unauthenticated users to /login and does not fetch", async () => {
    authState.isAuthenticated = false;
    authState.isVorstand = false;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("redirects authenticated non-Vorstand-non-Admin users to / and does not fetch", async () => {
    authState.isAuthenticated = true;
    authState.isVorstand = false;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("loads members for a Vorstand user and renders a row per member", async () => {
    authState.isVorstand = true;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(memberListCalls().length).toBeGreaterThan(0));
    expect(await screen.findByText("Anna Alpha")).toBeInTheDocument();
    expect(screen.getByText("Bert Beta")).toBeInTheDocument();
  });

  it("loads members for an Admin user and renders rows", async () => {
    renderPage();

    expect(await screen.findByText("Anna Alpha")).toBeInTheDocument();
    expect(screen.getByText("Bert Beta")).toBeInTheDocument();
  });

  it("requests the initial page with page=1 and pageSize=10", async () => {
    renderPage();

    await waitFor(() => expect(memberListCalls().length).toBeGreaterThan(0));
    const endpoint = memberListCalls()[0][0] as string;
    expect(endpoint).toContain("page=1");
    expect(endpoint).toContain("pageSize=10");
  });

  it("renders detail and edit links with the correct hrefs", async () => {
    membersPayload.items = [MEMBERS[0]];

    renderPage();
    await screen.findByText("Anna Alpha");

    const detail = screen.getByTitle("common.details");
    expect(detail).toHaveAttribute(
      "href",
      "/members/11111111-1111-1111-1111-111111111111"
    );
    const edit = screen.getByTitle("common.edit");
    expect(edit).toHaveAttribute(
      "href",
      "/members/11111111-1111-1111-1111-111111111111/edit"
    );
  });

  it("shows the CSV export button for an Admin", async () => {
    renderPage();
    await screen.findByText("Anna Alpha");

    expect(
      screen.getByRole("button", { name: "members.exportCsv" })
    ).toBeInTheDocument();
  });

  it("hides the CSV export button for a Vorstand-only user", async () => {
    authState.isVorstand = true;
    authState.isAdmin = false;

    renderPage();
    await screen.findByText("Anna Alpha");

    expect(
      screen.queryByRole("button", { name: "members.exportCsv" })
    ).not.toBeInTheDocument();
  });

  it("exports CSV via the api client when an Admin clicks export", async () => {
    renderPage();
    await screen.findByText("Anna Alpha");

    fireEvent.click(screen.getByRole("button", { name: "members.exportCsv" }));

    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith("/api/v1/reports/export/members")
    );
  });

  it("shows a per-row Delete button for an Admin", async () => {
    renderPage();
    await screen.findByText("Anna Alpha");

    const deleteButtons = screen.getAllByRole("button", {
      name: "common.delete",
    });
    expect(deleteButtons).toHaveLength(MEMBERS.length);
  });

  it("hides the per-row Delete button for a Vorstand-only user", async () => {
    authState.isVorstand = true;
    authState.isAdmin = false;

    renderPage();
    await screen.findByText("Anna Alpha");

    expect(
      screen.queryByRole("button", { name: "common.delete" })
    ).not.toBeInTheDocument();
  });

  it("renders statistics cards when the statistics payload is present", async () => {
    renderPage();

    expect(
      await screen.findByText("members.statistics.active")
    ).toBeInTheDocument();
    expect(screen.getByText("members.statistics.pending")).toBeInTheDocument();
  });

  it("omits statistics cards when the statistics fetch errors", async () => {
    statisticsOk = false;

    renderPage();
    await screen.findByText("Anna Alpha");

    expect(
      screen.queryByText("members.statistics.active")
    ).not.toBeInTheDocument();
  });

  it("submitting the search form refetches with the search term and page=1", async () => {
    renderPage();
    await screen.findByText("Anna Alpha");
    const before = memberListCalls().length;

    fireEvent.change(screen.getByPlaceholderText("members.searchPlaceholder"), {
      target: { value: "Anna" },
    });
    const input = screen.getByPlaceholderText("members.searchPlaceholder");
    fireEvent.submit(input.closest("form")!);

    await waitFor(() =>
      expect(memberListCalls().length).toBeGreaterThan(before)
    );
    const last = memberListCalls().at(-1)![0] as string;
    expect(last).toContain("search=Anna");
    expect(last).toContain("page=1");
  });

  it("changing the status filter refetches with status= and page=1", async () => {
    renderPage();
    await screen.findByText("Anna Alpha");
    const before = memberListCalls().length;

    fireEvent.change(screen.getByLabelText("members.allStatuses"), {
      target: { value: "Active" },
    });

    await waitFor(() =>
      expect(memberListCalls().length).toBeGreaterThan(before)
    );
    const last = memberListCalls().at(-1)![0] as string;
    expect(last).toContain("status=Active");
    expect(last).toContain("page=1");
  });

  it("changing the type filter refetches with type= and page=1", async () => {
    renderPage();
    await screen.findByText("Anna Alpha");
    const before = memberListCalls().length;

    fireEvent.change(screen.getByLabelText("members.allTypes"), {
      target: { value: "Student" },
    });

    await waitFor(() =>
      expect(memberListCalls().length).toBeGreaterThan(before)
    );
    const last = memberListCalls().at(-1)![0] as string;
    expect(last).toContain("type=Student");
    expect(last).toContain("page=1");
  });

  it("does not render the pagination block when totalPages === 1", async () => {
    renderPage();
    await screen.findByText("Anna Alpha");

    expect(
      screen.queryByRole("button", { name: "common.previous" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "common.next" })
    ).not.toBeInTheDocument();
  });

  it("disables Prev at page 1 and enables Next when totalPages > 1", async () => {
    membersPayload.totalPages = 3;
    membersPayload.totalCount = 25;

    renderPage();
    await screen.findByText("Anna Alpha");

    expect(
      screen.getByRole("button", { name: "common.previous" })
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "common.next" })).toBeEnabled();
  });

  it("disables Next once the last page is reached", async () => {
    membersPayload.totalPages = 2;
    membersPayload.totalCount = 15;

    renderPage();
    await screen.findByText("Anna Alpha");

    fireEvent.click(screen.getByRole("button", { name: "common.next" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "common.next" })).toBeDisabled()
    );
    expect(
      screen.getByRole("button", { name: "common.previous" })
    ).toBeEnabled();
  });

  it("opens the delete dialog, deletes via the api client, then refetches members + statistics", async () => {
    membersPayload.items = [MEMBERS[0]];
    membersPayload.totalCount = 1;

    renderPage();
    await screen.findByText("Anna Alpha");
    const membersBefore = memberListCalls().length;
    const statsBefore = statisticsCalls().length;

    // open the confirmation dialog via the row's delete trigger
    fireEvent.click(screen.getByRole("button", { name: "common.delete" }));

    // confirm: the dialog's delete button is the last "common.delete" button
    const deleteButtons = await screen.findAllByRole("button", {
      name: "common.delete",
    });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);

    await waitFor(() =>
      expect(apiDelete).toHaveBeenCalledWith(
        "/api/v1/members/11111111-1111-1111-1111-111111111111"
      )
    );
    // Both members and statistics refetch after a successful delete.
    await waitFor(() =>
      expect(memberListCalls().length).toBeGreaterThan(membersBefore)
    );
    await waitFor(() =>
      expect(statisticsCalls().length).toBeGreaterThan(statsBefore)
    );
  });

  it("does not fire DELETE when the dialog is cancelled", async () => {
    renderPage();
    await screen.findByText("Anna Alpha");

    // open the dialog from the first row, then cancel
    fireEvent.click(
      screen.getAllByRole("button", { name: "common.delete" })[0]
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "common.cancel" })
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "common.cancel" })
      ).not.toBeInTheDocument()
    );
    expect(apiDelete).not.toHaveBeenCalled();
  });

  it("surfaces a failed delete in the error banner", async () => {
    membersPayload.items = [MEMBERS[0]];
    membersPayload.totalCount = 1;
    apiDelete.mockResolvedValue({
      data: null,
      error: "error.deletingError",
      status: 500,
    });

    renderPage();
    await screen.findByText("Anna Alpha");

    fireEvent.click(screen.getByRole("button", { name: "common.delete" }));
    const deleteButtons = await screen.findAllByRole("button", {
      name: "common.delete",
    });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);

    expect(await screen.findByText("error.deletingError")).toBeInTheDocument();
  });

  it("renders the empty state when no members are returned", async () => {
    membersPayload.items = [];
    membersPayload.totalCount = 0;

    renderPage();

    expect(
      await screen.findByText("common.noMembersFound")
    ).toBeInTheDocument();
  });

  it("renders the inline error banner with a retry control on list error", async () => {
    membersError = "Network down";

    renderPage();

    // The query error message is surfaced verbatim in the banner.
    expect(await screen.findByText("Network down")).toBeInTheDocument();
    const retry = screen.getByRole("button", { name: "common.tryAgain" });
    expect(retry).toBeInTheDocument();

    // Retry refetches; recover by clearing the error flag first.
    membersError = null;
    const before = memberListCalls().length;
    fireEvent.click(retry);
    await waitFor(() =>
      expect(memberListCalls().length).toBeGreaterThan(before)
    );
  });
});
