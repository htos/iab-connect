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
import type React from "react";

// React 19 `use(promise)` Suspends on first render; drive it synchronously off a
// sync-thenable (the established [id]-page S1 pattern) so the page reads the
// resolved params without a Suspense boundary.
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    use: (input: unknown) => {
      const maybeThenable = input as {
        then?: (cb: (v: unknown) => void) => void;
      };
      if (maybeThenable && typeof maybeThenable.then === "function") {
        let resolved: unknown;
        let didResolve = false;
        maybeThenable.then((v) => {
          resolved = v;
          didResolve = true;
        });
        if (didResolve) return resolved;
        throw input;
      }
      return (actual.use as unknown as (x: unknown) => unknown)(input);
    },
  };
});

function syncThenable<T>(value: T): Promise<T> {
  return { then: (cb: (v: T) => void) => cb(value) } as unknown as Promise<T>;
}

/**
 * E27-S1 — Characterization (regression net) for the ADMIN USER SESSIONS page
 * (REQ-010, src/app/admin/users/[id]/sessions/page.tsx).
 *
 * Pins CURRENT observable behaviour BEFORE refactor. Legacy transport:
 * `getUserSessions` (initial load, guarded by an `initialFetchDone` ref so it
 * fires once) + `revokeUserSession`, token-param functions from
 * `@/lib/api/users` over useState/useEffect. The page receives `params` as a
 * Promise unwrapped with React `use()` — we pass a resolved Promise prop.
 * QueryClientProvider wrapper is inert.
 *
 * i18n: `useTranslations()` with NO namespace → DOTTED keys, identity translator
 * (t("profileSecurity.revoke") === "profileSecurity.revoke",
 *  t("common.refresh") === "common.refresh").
 *
 * Hooks preserved AS-IS: data-testid="admin-sessions-empty" / "admin-sessions-list"
 * / `admin-revoke-session-{id}`; role="alert" (error) / role="status" (message).
 * window.confirm gates revoke.
 *
 * // A79 deltas:
 * - Plain useState/useEffect + an `initialFetchDone` ref: the initial fetch is
 *   one-shot. The retry:false QueryClient is inert here.
 * - The `message` banner auto-clears after 4000ms via setTimeout in the revoke
 *   handler's `finally`. The handler awaits a real promise before scheduling
 *   the timeout, so a fully-faked clock races the microtask queue; instead we
 *   spy on window.setTimeout, ASSERT a 4000ms delay was scheduled, and collapse
 *   just that timer to an immediate tick so waitFor observes the clear without a
 *   4s real-time wait (other timers pass through untouched). Behaviour pinned;
 *   the precise wall-clock 4s is an implementation timing a unit harness can't
 *   meaningfully assert in real time.
 * - GATED PATH: when !auth || !admin the page returns `null` AFTER the loading
 *   gate — but with loading initially true the spinner shows first; once
 *   authLoading is false and !admin, the redirect fires and the component
 *   returns null. Pinned: redirect + getUserSessions never called.
 */

vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

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
}));

const getUserSessions = vi.fn();
const revokeUserSession = vi.fn();
vi.mock("@/lib/api/users", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api/users")>("@/lib/api/users");
  return {
    ...actual,
    getUserSessions: (...args: unknown[]) => getUserSessions(...args),
    revokeUserSession: (...args: unknown[]) => revokeUserSession(...args),
  };
});

import AdminUserSessionsPage from "./page";
import type { UserSession } from "@/lib/api/users";

function makeSession(over: Partial<UserSession> = {}): UserSession {
  return {
    id: "sess-1",
    ipAddress: "203.0.113.7",
    start: "2024-01-15T10:00:00Z",
    lastAccess: "2024-01-15T12:00:00Z",
    clients: ["account"],
    ...over,
  };
}

function renderWithClient() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <AdminUserSessionsPage params={syncThenable({ id: "user-1" })} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  getUserSessions.mockResolvedValue({ sessions: [makeSession()] });
  revokeUserSession.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isAdmin = true;
  authState.accessToken = "test-token";
  authState.isLoading = false;
});

describe("admin/users/[id]/sessions — characterization (E27-S1)", () => {
  // ---- AC-1 GUARD --------------------------------------------------------
  it("redirects an authenticated NON-admin to / and never fetches sessions", async () => {
    authState.isAdmin = false;

    renderWithClient();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(getUserSessions).not.toHaveBeenCalled();
  });

  it("redirects an UNAUTHENTICATED user to / and never fetches sessions", async () => {
    authState.isAuthenticated = false;
    authState.isAdmin = false;

    renderWithClient();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(getUserSessions).not.toHaveBeenCalled();
  });

  // ---- LOAD --------------------------------------------------------------
  it("loads sessions via getUserSessions(token,userId) and renders the list with the revoke control", async () => {
    renderWithClient();

    expect(
      await screen.findByTestId("admin-sessions-list")
    ).toBeInTheDocument();
    expect(getUserSessions).toHaveBeenCalledWith("test-token", "user-1");
    // preserved per-row data-testid hook
    expect(
      screen.getByTestId("admin-revoke-session-sess-1")
    ).toBeInTheDocument();
    // page title (dotted key)
    expect(screen.getByText("profileSecurity.adminTitle")).toBeInTheDocument();
  });

  it("renders the empty state (admin-sessions-empty) when no sessions exist", async () => {
    getUserSessions.mockResolvedValue({ sessions: [] });

    renderWithClient();

    expect(
      await screen.findByTestId("admin-sessions-empty")
    ).toBeInTheDocument();
    expect(screen.getByText("profileSecurity.adminEmpty")).toBeInTheDocument();
    expect(screen.queryByTestId("admin-sessions-list")).not.toBeInTheDocument();
  });

  it("surfaces a load error in a role=alert banner", async () => {
    getUserSessions.mockRejectedValue(new Error("sessions boom"));

    renderWithClient();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("sessions boom");
  });

  // ---- REFRESH -----------------------------------------------------------
  it("the refresh button re-fetches sessions", async () => {
    renderWithClient();
    await screen.findByTestId("admin-sessions-list");
    const before = getUserSessions.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "common.refresh" }));

    await waitFor(() =>
      expect(getUserSessions.mock.calls.length).toBeGreaterThan(before)
    );
  });

  // ---- REVOKE (confirm; bordered-red; inline message) --------------------
  it("the revoke button is bordered-red (border-red-300 text-red-700)", async () => {
    renderWithClient();
    await screen.findByTestId("admin-sessions-list");

    const btn = screen.getByTestId("admin-revoke-session-sess-1");
    expect(btn.className).toContain("border-red-300");
    expect(btn.className).toContain("text-red-700");
  });

  it("revoke confirm→success calls revokeUserSession, removes the row, shows a success status banner", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderWithClient();
    await screen.findByTestId("admin-sessions-list");

    fireEvent.click(screen.getByTestId("admin-revoke-session-sess-1"));

    expect(confirmSpy).toHaveBeenCalledWith(
      "profileSecurity.revokeConfirmAdmin"
    );
    await waitFor(() =>
      expect(revokeUserSession).toHaveBeenCalledWith(
        "test-token",
        "user-1",
        "sess-1"
      )
    );
    // row removed → list now empty
    await waitFor(() =>
      expect(screen.getByTestId("admin-sessions-empty")).toBeInTheDocument()
    );
    // success message in a role=status banner
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("profileSecurity.revokeSuccess");
  });

  it("revoke is aborted (no transport call) when confirm is cancelled", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);

    renderWithClient();
    await screen.findByTestId("admin-sessions-list");

    fireEvent.click(screen.getByTestId("admin-revoke-session-sess-1"));
    expect(revokeUserSession).not.toHaveBeenCalled();
    // row preserved
    expect(
      screen.getByTestId("admin-revoke-session-sess-1")
    ).toBeInTheDocument();
  });

  it("AC-8: a FAILED revoke shows the error message and PRESERVES the session row", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    revokeUserSession.mockRejectedValue(new Error("revoke 500"));

    renderWithClient();
    await screen.findByTestId("admin-sessions-list");

    fireEvent.click(screen.getByTestId("admin-revoke-session-sess-1"));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "profileSecurity.revokeError"
      )
    );
    // list preserved on failure
    expect(
      screen.getByTestId("admin-revoke-session-sess-1")
    ).toBeInTheDocument();
  });

  it("the success message auto-clears via a 4000ms setTimeout after a revoke", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    // Capture the auto-clear timeout callback + delay without faking the whole
    // clock (the handler awaits a real promise, so a fully-faked clock races the
    // microtask queue). The spy lets us assert the 4000ms delay AND fire the
    // clear deterministically — pinning the auto-clear behaviour observably.
    const realSetTimeout = window.setTimeout.bind(window);
    const scheduledDelays: number[] = [];
    const timeoutSpy = vi.spyOn(window, "setTimeout").mockImplementation(((
      cb: TimerHandler,
      delay?: number,
      ...rest: unknown[]
    ) => {
      scheduledDelays.push(delay ?? 0);
      // Collapse the real 4000ms auto-clear to an immediate tick so waitFor
      // observes the clear without a 4s real-time wait; other timers (e.g.
      // testing-library's own) pass through with their original delay.
      const effective = delay === 4000 ? 0 : delay;
      return realSetTimeout(cb as () => void, effective, ...rest);
    }) as typeof window.setTimeout);

    renderWithClient();
    await screen.findByTestId("admin-sessions-list");

    fireEvent.click(screen.getByTestId("admin-revoke-session-sess-1"));

    // success banner appears after the awaited revoke resolves
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "profileSecurity.revokeSuccess"
      )
    );

    // the handler scheduled a 4000ms auto-clear timeout (pinned),
    expect(scheduledDelays).toContain(4000);

    // and that timeout (collapsed to immediate) clears the message banner.
    await waitFor(() =>
      expect(screen.queryByRole("status")).not.toBeInTheDocument()
    );
    timeoutSpy.mockRestore();
  });
});
