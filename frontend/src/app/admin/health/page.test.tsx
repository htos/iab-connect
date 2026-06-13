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

// E27-S1 characterization tests (regression net) for the System Health admin page.
// Pins CURRENT observable behaviour at HEAD. No production code changed.
// The page consumes the health transport directly with the access token
// (NOT useApiClient). We mock getHealthDetail at the boundary and keep the real
// getStatusColor so badge className assertions pin the real colour logic.
//
// A79 deltas: this page does NOT use TanStack Query; data is fetched via
// useState/useEffect, so `retry:false` masks nothing. The page wires a 30s
// setInterval(fetchHealth, 30000) auto-refresh. We pin that wiring with fake
// timers (see "30s auto-refresh"): advancing virtual time by 30s triggers an
// additional getHealthDetail call. `lastChecked` is set after each successful
// fetch and rendered in the header.

// A64: STABLE identity translation function. The health page puts `t` in the
// fetchHealth useCallback deps AND uses fetchHealth as an effect dependency; an
// unstable `t` (new arrow each render) would create an infinite render loop. A
// hoisted, stable identity fn keeps fetchHealth referentially stable.
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

const getHealthDetail = vi.fn();
vi.mock("@/features/admin-system/api/health", async () => {
  const actual =
    await vi.importActual<typeof import("@/features/admin-system/api/health")>(
      "@/features/admin-system/api/health"
    );
  return {
    ...actual,
    getHealthDetail: (...a: unknown[]) => getHealthDetail(...a),
  };
});

import HealthPage from "./page";

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function makeHealth(overrides: Record<string, unknown> = {}) {
  return {
    status: "Healthy",
    totalDuration: 12.3,
    entries: [
      {
        name: "database",
        status: "Healthy",
        description: "DB ok",
        duration: 5.1,
        exception: null,
      },
      {
        name: "redis",
        status: "Degraded",
        description: null,
        duration: 2.0,
        exception: null,
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  getHealthDetail.mockResolvedValue(makeHealth());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isAdmin = true;
  authState.accessToken = "test-token";
});

describe("HealthPage — AC-1 guard", () => {
  it("redirects non-admin users to '/'", async () => {
    authState.isAdmin = false;
    renderWithClient(<HealthPage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("redirects unauthenticated users to '/'", async () => {
    authState.isAuthenticated = false;
    renderWithClient(<HealthPage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("does not fetch health when not admin", async () => {
    authState.isAdmin = false;
    renderWithClient(<HealthPage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(getHealthDetail).not.toHaveBeenCalled();
  });

  it("fetches health when admin with a token", async () => {
    renderWithClient(<HealthPage />);
    await waitFor(() =>
      expect(getHealthDetail).toHaveBeenCalledWith("test-token")
    );
  });
});

describe("HealthPage — status render", () => {
  it("renders the page title and overall status section", async () => {
    renderWithClient(<HealthPage />);
    await waitFor(() => expect(getHealthDetail).toHaveBeenCalled());
    expect(screen.getByText("title")).toBeInTheDocument();
    expect(await screen.findByText("overallStatus")).toBeInTheDocument();
  });

  it("renders the overall status badge (Healthy) with the real green colour class", async () => {
    // Entries use non-Healthy statuses so the only "Healthy" text is the overall badge.
    getHealthDetail.mockResolvedValue(
      makeHealth({
        status: "Healthy",
        entries: [
          {
            name: "database",
            status: "Degraded",
            description: null,
            duration: 1,
            exception: null,
          },
        ],
      })
    );
    renderWithClient(<HealthPage />);
    const badge = await screen.findByText("Healthy");
    expect(badge.className).toContain("text-green-700");
    expect(badge.className).toContain("bg-green-100");
  });

  it("renders one card per service entry with name and per-service status badge", async () => {
    renderWithClient(<HealthPage />);
    expect(await screen.findByText("database")).toBeInTheDocument();
    expect(screen.getByText("redis")).toBeInTheDocument();
    // redis is Degraded -> yellow badge
    const degraded = screen.getByText("Degraded");
    expect(degraded.className).toContain("text-yellow-700");
    expect(degraded.className).toContain("bg-yellow-100");
  });

  it("renders the exception box for an entry with an exception", async () => {
    getHealthDetail.mockResolvedValue(
      makeHealth({
        status: "Unhealthy",
        entries: [
          {
            name: "database",
            status: "Unhealthy",
            description: null,
            duration: 9.9,
            exception: "Timeout connecting",
          },
        ],
      })
    );
    renderWithClient(<HealthPage />);
    expect(await screen.findByText("Timeout connecting")).toBeInTheDocument();
  });

  it("shows the lastChecked timestamp label after a successful fetch", async () => {
    renderWithClient(<HealthPage />);
    expect(await screen.findByText(/lastChecked/)).toBeInTheDocument();
  });

  it("surfaces fetchError when the fetch rejects", async () => {
    getHealthDetail.mockRejectedValue(new Error("net"));
    renderWithClient(<HealthPage />);
    expect(await screen.findByText("fetchError")).toBeInTheDocument();
  });
});

describe("HealthPage — manual refresh", () => {
  it("re-fetches health when the refresh button is clicked", async () => {
    renderWithClient(<HealthPage />);
    await waitFor(() => expect(getHealthDetail).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText("refresh"));
    await waitFor(() => expect(getHealthDetail).toHaveBeenCalledTimes(2));
  });
});

describe("HealthPage — 30s auto-refresh (DEC-2=A fake timers)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("re-fetches roughly every 30s via the setInterval wiring", async () => {
    getHealthDetail.mockResolvedValue(makeHealth());
    renderWithClient(<HealthPage />);

    // initial mount fetch
    await vi.waitFor(() => expect(getHealthDetail).toHaveBeenCalledTimes(1));

    // advance one interval period (30s) -> one additional fetch
    await vi.advanceTimersByTimeAsync(30000);
    expect(getHealthDetail).toHaveBeenCalledTimes(2);

    // advance another period -> another fetch
    await vi.advanceTimersByTimeAsync(30000);
    expect(getHealthDetail).toHaveBeenCalledTimes(3);
  });
});
