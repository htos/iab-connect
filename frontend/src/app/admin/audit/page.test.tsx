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

// E27-S1 characterization tests (regression net) for the Audit Log admin page.
// Pins CURRENT observable behaviour at HEAD. No production code changed.
// The page consumes the @/lib/api/audit transport functions directly with the
// access token (NOT useApiClient), so we mock that module at the boundary.
// The page colour helpers (getSeverityColor/getCategoryColor) are intentionally
// NOT mocked — we keep the real implementations so badge className assertions pin
// the real colour logic. formatAuditDate is also kept real.
//
// A79 deltas: this page does NOT use TanStack Query; data is loaded via
// useState/useEffect, so `retry:false` masks nothing here. The QueryClientProvider
// wrapper is inert. No timer-based behaviour on this page.

// A64: STABLE identity translation function. fetchEvents/fetchFilterOptions depend
// on `t` and feed effect dependency arrays; an unstable `t` (new arrow each render)
// causes spurious refetch loops and non-deterministic call counts. A hoisted stable
// identity fn mirrors production (next-intl memoizes the translator).
const tFn = (key: string) => key;
vi.mock("next-intl", () => ({ useTranslations: () => tFn }));
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const authState = {
  isAuthenticated: true,
  isLoading: false,
  isAdmin: true,
  accessToken: "test-token",
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => ({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
  }),
}));

const getAuditEvents = vi.fn();
const exportAuditEvents = vi.fn();
const getAuditCategories = vi.fn();
const getAuditEventTypes = vi.fn();
vi.mock("@/lib/api/audit", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api/audit")>("@/lib/api/audit");
  return {
    ...actual,
    getAuditEvents: (...args: unknown[]) => getAuditEvents(...args),
    exportAuditEvents: (...args: unknown[]) => exportAuditEvents(...args),
    getAuditCategories: (...args: unknown[]) => getAuditCategories(...args),
    getAuditEventTypes: (...args: unknown[]) => getAuditEventTypes(...args),
  };
});

import AuditPage from "./page";

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

// The audit filter labels are NOT wired to their controls via htmlFor/id, so
// getByLabelText does not work. This helper finds a filter's control by locating
// the label text and reading the control inside the same wrapping <div>.
function controlForLabel(labelText: string): HTMLElement {
  const label = screen.getByText(labelText);
  const wrapper = label.parentElement as HTMLElement;
  const control = wrapper.querySelector("select, input, textarea");
  if (!control) throw new Error(`No control found for label '${labelText}'`);
  return control as HTMLElement;
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "e1",
    timestamp: "2026-06-01T10:00:00Z",
    eventType: "LoginSucceeded",
    category: "Authentication",
    severity: "Info",
    userId: "u1",
    userName: "Alice",
    ipAddress: "1.2.3.4",
    entityType: null,
    entityId: null,
    action: "User logged in",
    details: null,
    success: true,
    errorMessage: null,
    ...overrides,
  };
}

function mockListResponse(
  items: unknown[],
  extra: Record<string, unknown> = {}
) {
  getAuditEvents.mockResolvedValue({
    items,
    totalCount: items.length,
    page: 1,
    pageSize: 50,
    totalPages: 1,
    ...extra,
  });
}

beforeEach(() => {
  getAuditCategories.mockResolvedValue([
    { value: "Authentication", label: "Authentication" },
  ]);
  getAuditEventTypes.mockResolvedValue([
    {
      value: "LoginSucceeded",
      label: "Login Succeeded",
      category: "Authentication",
    },
  ]);
  mockListResponse([makeEvent()]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isAdmin = true;
  authState.accessToken = "test-token";
});

describe("AuditPage — AC-1 guard", () => {
  it("redirects non-admin users to '/' (not /login)", async () => {
    authState.isAdmin = false;
    renderWithClient(<AuditPage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("redirects unauthenticated users to '/'", async () => {
    authState.isAuthenticated = false;
    renderWithClient(<AuditPage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("does not fetch events when not admin", async () => {
    authState.isAdmin = false;
    renderWithClient(<AuditPage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(getAuditEvents).not.toHaveBeenCalled();
  });

  it("renders nothing (null) for an authenticated non-admin", () => {
    authState.isAdmin = false;
    const { container } = renderWithClient(<AuditPage />);
    expect(container.querySelector("main")).toBeNull();
  });

  it("fetches events when authenticated admin with a token", async () => {
    renderWithClient(<AuditPage />);
    await waitFor(() => expect(getAuditEvents).toHaveBeenCalled());
    expect(getAuditEvents).toHaveBeenCalledWith(
      "test-token",
      expect.objectContaining({ page: 1, pageSize: 50 })
    );
  });
});

describe("AuditPage — log load / empty / error", () => {
  it("renders the title and loaded events", async () => {
    mockListResponse([makeEvent({ action: "User logged in" })]);
    renderWithClient(<AuditPage />);
    await waitFor(() => expect(screen.getByText("title")).toBeInTheDocument());
    expect(await screen.findByText("User logged in")).toBeInTheDocument();
  });

  it("shows the empty-state row when there are no events", async () => {
    mockListResponse([]);
    renderWithClient(<AuditPage />);
    expect(await screen.findByText("table.noResults")).toBeInTheDocument();
  });

  it("surfaces an error message when the load fails", async () => {
    getAuditEvents.mockRejectedValue(new Error("boom"));
    renderWithClient(<AuditPage />);
    expect(await screen.findByText("boom")).toBeInTheDocument();
  });

  it("renders the results-summary i18n key", async () => {
    renderWithClient(<AuditPage />);
    await waitFor(() =>
      expect(screen.getByText("results.showing")).toBeInTheDocument()
    );
  });
});

describe("AuditPage — badges (real colour helpers)", () => {
  it("renders the severity badge with the real severity colour class", async () => {
    mockListResponse([makeEvent({ severity: "Critical" })]);
    renderWithClient(<AuditPage />);
    const badge = await screen.findByText("Critical");
    expect(badge.className).toContain("bg-red-100");
    expect(badge.className).toContain("text-red-800");
  });

  it("renders the category badge with the real category colour class", async () => {
    mockListResponse([makeEvent({ category: "Authentication" })]);
    renderWithClient(<AuditPage />);
    const badge = await screen.findByText("Authentication");
    expect(badge.className).toContain("bg-purple-100");
  });

  it("renders the success status badge (green) for successful events", async () => {
    mockListResponse([makeEvent({ success: true })]);
    renderWithClient(<AuditPage />);
    const badge = await screen.findByText("status.success");
    expect(badge.className).toContain("bg-green-100");
  });

  it("renders the failure status badge (red) for failed events", async () => {
    mockListResponse([makeEvent({ success: false, errorMessage: "denied" })]);
    renderWithClient(<AuditPage />);
    const badge = await screen.findByText("status.failure");
    expect(badge.className).toContain("bg-red-100");
  });
});

describe("AuditPage — collapsible filter panel + 7 server-side filters", () => {
  it("hides the filter panel by default and shows it after toggling", async () => {
    renderWithClient(<AuditPage />);
    await waitFor(() => expect(getAuditEvents).toHaveBeenCalled());
    expect(screen.queryByText("filters.fromDate")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("filters.toggle"));
    expect(screen.getByText("filters.fromDate")).toBeInTheDocument();
    expect(screen.getByText("filters.toDate")).toBeInTheDocument();
    expect(screen.getByText("filters.category")).toBeInTheDocument();
    expect(screen.getByText("filters.eventType")).toBeInTheDocument();
    expect(screen.getByText("filters.severity")).toBeInTheDocument();
    expect(screen.getByText("filters.status")).toBeInTheDocument();
    expect(screen.getByText("filters.search")).toBeInTheDocument();
  });

  it("changing the severity filter resets page to 1 and refetches", async () => {
    renderWithClient(<AuditPage />);
    await waitFor(() => expect(getAuditEvents).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText("filters.toggle"));
    const severitySelect = controlForLabel("filters.severity");
    fireEvent.change(severitySelect, { target: { value: "Warning" } });
    await waitFor(() =>
      expect(getAuditEvents).toHaveBeenLastCalledWith(
        "test-token",
        expect.objectContaining({ severity: "Warning", page: 1 })
      )
    );
  });

  it("changing the search filter refetches with the search term and page 1", async () => {
    renderWithClient(<AuditPage />);
    await waitFor(() => expect(getAuditEvents).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText("filters.toggle"));
    const searchInput = screen.getByPlaceholderText(
      "filters.searchPlaceholder"
    );
    fireEvent.change(searchInput, { target: { value: "alice" } });
    await waitFor(() =>
      expect(getAuditEvents).toHaveBeenLastCalledWith(
        "test-token",
        expect.objectContaining({ search: "alice", page: 1 })
      )
    );
  });

  it("changing the success filter to 'true' refetches with success boolean true", async () => {
    renderWithClient(<AuditPage />);
    await waitFor(() => expect(getAuditEvents).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText("filters.toggle"));
    const statusSelect = controlForLabel("filters.status");
    fireEvent.change(statusSelect, { target: { value: "true" } });
    await waitFor(() =>
      expect(getAuditEvents).toHaveBeenLastCalledWith(
        "test-token",
        expect.objectContaining({ success: true, page: 1 })
      )
    );
  });

  it("clearing filters resets to the default page/pageSize filter set", async () => {
    renderWithClient(<AuditPage />);
    await waitFor(() => expect(getAuditEvents).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText("filters.toggle"));
    fireEvent.change(controlForLabel("filters.severity"), {
      target: { value: "Warning" },
    });
    await waitFor(() => expect(getAuditEvents).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByText("filters.clear"));
    await waitFor(() =>
      expect(getAuditEvents).toHaveBeenLastCalledWith("test-token", {
        page: 1,
        pageSize: 50,
      })
    );
  });
});

describe("AuditPage — pagination", () => {
  it("does NOT render pagination when totalPages is 1", async () => {
    mockListResponse([makeEvent()], { totalPages: 1 });
    renderWithClient(<AuditPage />);
    await waitFor(() => expect(getAuditEvents).toHaveBeenCalled());
    expect(screen.queryByText("pagination.page")).not.toBeInTheDocument();
  });

  it("renders pagination controls when totalPages > 1", async () => {
    mockListResponse([makeEvent()], { totalPages: 3, totalCount: 120 });
    renderWithClient(<AuditPage />);
    expect(await screen.findByText("pagination.page")).toBeInTheDocument();
    expect(screen.getByText("next")).toBeInTheDocument();
    expect(screen.getByText("previous")).toBeInTheDocument();
  });

  it("clicking 'next' refetches with the incremented page", async () => {
    mockListResponse([makeEvent()], { totalPages: 3, totalCount: 120 });
    renderWithClient(<AuditPage />);
    await screen.findByText("pagination.page");
    fireEvent.click(screen.getByText("next"));
    await waitFor(() =>
      expect(getAuditEvents).toHaveBeenLastCalledWith(
        "test-token",
        expect.objectContaining({ page: 2 })
      )
    );
  });
});

describe("AuditPage — CSV export", () => {
  it("calls exportAuditEvents and triggers an anchor download named audit_export_<date>.csv", async () => {
    const blob = new Blob(["a,b,c"], { type: "text/csv" });
    exportAuditEvents.mockResolvedValue(blob);

    const createObjectURL = vi.fn(() => "blob:fake");
    const revokeObjectURL = vi.fn();
    // jsdom does not implement these — stub them.
    (window.URL as unknown as { createObjectURL: unknown }).createObjectURL =
      createObjectURL;
    (window.URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL =
      revokeObjectURL;

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    renderWithClient(<AuditPage />);
    await waitFor(() => expect(getAuditEvents).toHaveBeenCalled());

    fireEvent.click(screen.getByText("export"));

    await waitFor(() =>
      expect(exportAuditEvents).toHaveBeenCalledWith(
        "test-token",
        expect.any(Object)
      )
    );
    await waitFor(() => expect(clickSpy).toHaveBeenCalled());
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(revokeObjectURL).toHaveBeenCalled();

    clickSpy.mockRestore();
  });

  it("surfaces an export error when exportAuditEvents rejects", async () => {
    exportAuditEvents.mockRejectedValue(new Error("export-fail"));
    renderWithClient(<AuditPage />);
    await waitFor(() => expect(getAuditEvents).toHaveBeenCalled());
    fireEvent.click(screen.getByText("export"));
    expect(await screen.findByText("export-fail")).toBeInTheDocument();
  });
});
