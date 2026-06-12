// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * E29-S1: Characterization tests for the Profile Security page (REQ-010).
 *
 * Pins the CURRENT observable behaviour of
 * `frontend/src/app/profile/security/page.tsx` at HEAD BEFORE the E29-S4
 * feature-slice refactor. The page is a manual-`useState` god-page that loads
 * the authenticated user's Keycloak sessions via `@/lib/api/users`
 * (`getMySessions`) and revokes them via `revokeMySession`, guarding `confirm()`
 * and a `setTimeout` toast auto-dismiss.
 *
 * Assertions are at the OUTCOME level — i18n keys (identity translator),
 * roles/testids, service-fn call args, navigation — never display copy, so the
 * E29-S4 slice extraction keeps this net green under a changed mechanism.
 *
 * Mock fidelity (A64/A78): stable router/auth/translator references (define
 * once, mutate per test). DEC-1: `vi.mock("@/lib/api/users")` for the two
 * service fns; `vi.mock("@/lib/auth")` for a stable `useAuth`; `confirm` stubbed
 * for the revoke guard; fake timers for the 4000 ms toast auto-dismiss;
 * `vi.unstubAllGlobals()` in afterEach (A35/A46 jsdom + cleanup).
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

// @/lib/auth: configurable, STABLE auth state (mutate fields per test).
const authState = {
  isAuthenticated: true,
  isLoading: false,
  accessToken: "test-token" as string | null,
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
}));

// @/lib/api/users: mock the two service fns the page consumes.
vi.mock("@/lib/api/users", () => ({
  getMySessions: vi.fn(),
  revokeMySession: vi.fn(),
}));

import { getMySessions, revokeMySession } from "@/lib/api/users";
import ProfileSecurityPage from "./page";

const getMySessionsMock = vi.mocked(getMySessions);
const revokeMySessionMock = vi.mocked(revokeMySession);

const SESSION_A = {
  id: "session-a",
  ipAddress: "203.0.113.7",
  start: "2026-01-01T08:00:00Z",
  lastAccess: "2026-01-02T09:30:00Z",
  clients: ["account", "iab-connect"],
};

const SESSION_B = {
  id: "session-b",
  ipAddress: null,
  start: null,
  lastAccess: null,
  clients: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.accessToken = "test-token";

  getMySessionsMock.mockResolvedValue({ sessions: [SESSION_A] });
  revokeMySessionMock.mockResolvedValue(undefined);

  // confirm defaults to accepting the revoke; individual tests may override.
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true)
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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
      <ProfileSecurityPage />
    </QueryClientProvider>
  );
}

describe("ProfileSecurityPage — characterization (current behaviour)", () => {
  // --- Guard (page.tsx:82-86) -------------------------------------------
  it("redirects unauthenticated users to /login and does not fetch sessions", async () => {
    authState.isAuthenticated = false;
    authState.accessToken = null;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(getMySessionsMock).not.toHaveBeenCalled();
  });

  it("does NOT apply a member-status check — any authenticated user loads their sessions", async () => {
    renderPage();

    await waitFor(() =>
      expect(getMySessionsMock).toHaveBeenCalledWith("test-token")
    );
    expect(push).not.toHaveBeenCalled();
  });

  // --- Session load + render --------------------------------------------
  it("loads sessions with the access token and renders a list item per session", async () => {
    getMySessionsMock.mockResolvedValue({ sessions: [SESSION_A, SESSION_B] });

    renderPage();

    await waitFor(() =>
      expect(getMySessionsMock).toHaveBeenCalledWith("test-token")
    );
    expect(await screen.findByTestId("sessions-list")).toBeInTheDocument();
    expect(screen.getByTestId("revoke-session-session-a")).toBeInTheDocument();
    expect(screen.getByTestId("revoke-session-session-b")).toBeInTheDocument();
  });

  it("renders ipAddress when present and the notAvailable fallback when missing", async () => {
    getMySessionsMock.mockResolvedValue({ sessions: [SESSION_A, SESSION_B] });

    renderPage();

    expect(await screen.findByText("203.0.113.7")).toBeInTheDocument();
    // SESSION_B has null ip/start/lastAccess → notAvailable key surfaces.
    expect(
      screen.getAllByText("profileSecurity.notAvailable").length
    ).toBeGreaterThan(0);
  });

  it("renders a badge per client and omits the clients block when empty", async () => {
    getMySessionsMock.mockResolvedValue({ sessions: [SESSION_A, SESSION_B] });

    renderPage();

    await screen.findByTestId("sessions-list");
    // SESSION_A has two clients → two badges.
    expect(screen.getByText("account")).toBeInTheDocument();
    expect(screen.getByText("iab-connect")).toBeInTheDocument();
    // SESSION_B has no clients → the clients label is not duplicated for it.
    expect(screen.getAllByText("profileSecurity.clients")).toHaveLength(1);
  });

  it("renders the noSessions empty state when the list is empty", async () => {
    getMySessionsMock.mockResolvedValue({ sessions: [] });

    renderPage();

    expect(await screen.findByTestId("sessions-empty")).toBeInTheDocument();
    expect(screen.getByText("profileSecurity.noSessions")).toBeInTheDocument();
    expect(screen.queryByTestId("sessions-list")).not.toBeInTheDocument();
  });

  // --- Best-effort load (page.tsx:42-57) --------------------------------
  // HEAD quirk: on a getMySessions rejection the list stays EMPTY (no session
  // rows) AND the error string is set into the role="alert" banner. We pin both
  // facets of what actually ships.
  it("renders the empty list (no rows) when getMySessions rejects", async () => {
    getMySessionsMock.mockRejectedValue(new Error("Failed to fetch sessions"));

    renderPage();

    expect(await screen.findByTestId("sessions-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("sessions-list")).not.toBeInTheDocument();
  });

  it("surfaces the load failure message in an alert banner (HEAD behaviour)", async () => {
    getMySessionsMock.mockRejectedValue(new Error("Failed to fetch sessions"));

    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Failed to fetch sessions");
  });

  // --- Revoke (the ONLY mutating action) — page.tsx:63-76 ---------------
  it("revoke: confirm → revokeMySession(token, sessionId) → optimistic removal + success message", async () => {
    getMySessionsMock.mockResolvedValue({ sessions: [SESSION_A, SESSION_B] });

    renderPage();

    const revokeBtn = await screen.findByTestId("revoke-session-session-a");
    fireEvent.click(revokeBtn);

    await waitFor(() =>
      expect(revokeMySessionMock).toHaveBeenCalledWith(
        "test-token",
        "session-a"
      )
    );

    // Optimistic removal: the revoked row is gone, the other remains.
    await waitFor(() =>
      expect(
        screen.queryByTestId("revoke-session-session-a")
      ).not.toBeInTheDocument()
    );
    expect(screen.getByTestId("revoke-session-session-b")).toBeInTheDocument();

    // Success message in the role="status" region.
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("profileSecurity.revokeSuccess");
  });

  it("revoke: the success message is scheduled to auto-dismiss after 4000 ms", async () => {
    // Pin the dismiss DELAY + OUTCOME deterministically without a real 4 s
    // wait: spy on setTimeout to capture the (:76) `finally` schedule, assert
    // the 4000 ms delay, then invoke the captured callback inside `act` to
    // prove it clears the toast.
    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");

    renderPage();

    fireEvent.click(await screen.findByTestId("revoke-session-session-a"));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "profileSecurity.revokeSuccess"
      )
    );

    const dismiss = timeoutSpy.mock.calls.find((c) => c[1] === 4000);
    expect(dismiss).toBeDefined();

    // Running the captured callback clears the toast (auto-dismiss outcome).
    act(() => {
      (dismiss![0] as () => void)();
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    timeoutSpy.mockRestore();
  });

  it("revoke: a declined confirm() does not call revokeMySession", async () => {
    vi.stubGlobal(
      "confirm",
      vi.fn(() => false)
    );

    renderPage();

    fireEvent.click(await screen.findByTestId("revoke-session-session-a"));

    expect(revokeMySessionMock).not.toHaveBeenCalled();
    // The row is still present (no optimistic removal on a declined confirm).
    expect(screen.getByTestId("revoke-session-session-a")).toBeInTheDocument();
  });

  it("revoke error: surfaces the error message and the row is NOT removed", async () => {
    revokeMySessionMock.mockRejectedValue(new Error("nope"));

    renderPage();

    fireEvent.click(await screen.findByTestId("revoke-session-session-a"));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "profileSecurity.revokeError"
      )
    );
    // No optimistic removal on the error path — the row persists.
    expect(screen.getByTestId("revoke-session-session-a")).toBeInTheDocument();
  });

  // NOTE: the error path ALSO schedules the 4000 ms setTimeout (it is in the
  // `finally` block, :76) so the error message likewise auto-dismisses. The
  // distinguishing HEAD facts pinned above are: success removes the row, error
  // does not. Revoke is the ONLY mutating action — there is no device-change
  // action on this page.
});
