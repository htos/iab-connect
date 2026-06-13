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
 * E27-S1 — Characterization (regression net) for the ADMIN USERS EDIT page
 * (REQ-002, src/app/admin/users/[id]/page.tsx).
 *
 * Pins CURRENT observable behaviour BEFORE refactor. Legacy transport: on mount
 * `Promise.all([getUser, getAvailableRoles])`; on submit the TWO-STEP flow
 * `updateUser` → (conditional, Set-diff) `updateUserRoles` → `getUser` refresh →
 * success banner (NO redirect). All token-param functions from `@/features/admin-users/api/users-admin`
 * over useState/useEffect. The page receives `params` as a Promise and unwraps
 * it with React `use()` — so we pass a resolved Promise prop directly (no
 * useParams). QueryClientProvider wrapper is inert.
 *
 * i18n: `useTranslations("users")` + `useTranslations("common")`, identity.
 *
 * // A79 deltas:
 * - Plain useState/useEffect: no provider retry / double-fetch.
 * - GATED PATH QUIRK: on the non-admin path the data effect never runs so
 *   `isLoading` stays its initial `true` → ONLY the spinner renders (the
 *   `!user` not-found block is NOT reached because that block is behind the
 *   `isLoading` early-return). Redirect fires router.push("/") in parallel.
 *   Pinned: redirect + getUser never called.
 * - `!user` NOT-FOUND terminal block is reachable ONLY when the guard passes,
 *   the fetch settles (isLoading=false) AND user stayed null — i.e. getUser
 *   REJECTS (error set, user left null). Pinned that way below.
 * - On submit success the form is re-seeded from the refreshed getUser; no
 *   redirect occurs (success banner only).
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

const getUser = vi.fn();
const updateUser = vi.fn();
const updateUserRoles = vi.fn();
const getAvailableRoles = vi.fn();
vi.mock("@/features/admin-users/api/users-admin", async () => {
  const actual =
    await vi.importActual<typeof import("@/features/admin-users/api/users-admin")>("@/features/admin-users/api/users-admin");
  return {
    ...actual,
    getUser: (...args: unknown[]) => getUser(...args),
    updateUser: (...args: unknown[]) => updateUser(...args),
    updateUserRoles: (...args: unknown[]) => updateUserRoles(...args),
    getAvailableRoles: (...args: unknown[]) => getAvailableRoles(...args),
  };
});

import UserEditPage from "./page";
import type { User } from "@/features/admin-users/api/users-admin";

const ROLES = [
  { name: "member", description: "Mitglied" },
  { name: "admin", description: "Administrator" },
];

function makeUser(over: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "anna@alpha.example",
    firstName: "Anna",
    lastName: "Alpha",
    enabled: true,
    emailVerified: false,
    createdAt: "2024-01-15T10:00:00Z",
    roles: ["member"],
    ...over,
  };
}

function renderWithClient() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <UserEditPage params={syncThenable({ id: "user-1" })} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  getUser.mockResolvedValue(makeUser());
  getAvailableRoles.mockResolvedValue(ROLES);
  updateUser.mockResolvedValue(makeUser());
  updateUserRoles.mockResolvedValue(["member"]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isAdmin = true;
  authState.accessToken = "test-token";
  authState.isLoading = false;
});

describe("admin/users/[id] EDIT — characterization (E27-S1)", () => {
  // ---- AC-1 GUARD --------------------------------------------------------
  it("redirects an authenticated NON-admin to / and never fetches the user", async () => {
    authState.isAdmin = false;

    renderWithClient();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(getUser).not.toHaveBeenCalled();
    expect(screen.queryByText("editUser")).not.toBeInTheDocument();
  });

  it("redirects an UNAUTHENTICATED user to / and never fetches", async () => {
    authState.isAuthenticated = false;
    authState.isAdmin = false;

    renderWithClient();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(getUser).not.toHaveBeenCalled();
  });

  // ---- LOAD --------------------------------------------------------------
  it("loads the user + roles and seeds the form (email value, emailVerified field, roles)", async () => {
    getUser.mockResolvedValue(
      makeUser({ email: "seed@user.example", emailVerified: true })
    );

    renderWithClient();

    expect(await screen.findByText("editUser")).toBeInTheDocument();
    expect(getUser).toHaveBeenCalledWith("test-token", "user-1");
    expect(getAvailableRoles).toHaveBeenCalledWith("test-token");

    expect(screen.getByLabelText("email *")).toHaveValue("seed@user.example");
    // emailVerified is an edit-only checkbox, seeded true
    expect(
      screen.getByRole("checkbox", { name: "emailVerified" })
    ).toBeChecked();
    // role seeded from the user (member checked, admin not)
    expect(screen.getByRole("checkbox", { name: /member/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /admin/i })).not.toBeChecked();
  });

  it("renders the not-found terminal block when getUser rejects (user stays null)", async () => {
    getUser.mockRejectedValue(new Error("User not found"));

    renderWithClient();

    expect(await screen.findByText("userNotFound")).toBeInTheDocument();
    // the edit form heading is NOT rendered in the not-found branch
    expect(screen.queryByText("editUser")).not.toBeInTheDocument();
  });

  // ---- SUBMIT: TWO-STEP --------------------------------------------------
  it("submit with UNCHANGED roles calls updateUser only (no updateUserRoles), shows success banner, no redirect", async () => {
    renderWithClient();
    await screen.findByText("editUser");

    fireEvent.submit(screen.getByLabelText("email *").closest("form")!);

    await waitFor(() => expect(updateUser).toHaveBeenCalledTimes(1));
    const [token, id, req] = updateUser.mock.calls[0];
    expect(token).toBe("test-token");
    expect(id).toBe("user-1");
    expect(req).toMatchObject({
      email: "anna@alpha.example",
      enabled: true,
      emailVerified: false,
    });
    // roles unchanged → no roles call
    expect(updateUserRoles).not.toHaveBeenCalled();
    // success banner, NO navigation
    expect(await screen.findByText("userUpdated")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("submit with CHANGED roles calls updateUser THEN updateUserRoles (Set-diff), then refreshes via getUser", async () => {
    renderWithClient();
    await screen.findByText("editUser");
    const getUserCallsBefore = getUser.mock.calls.length;

    // add admin → role set differs from seeded ["member"]
    fireEvent.click(screen.getByRole("checkbox", { name: /admin/i }));
    fireEvent.submit(screen.getByLabelText("email *").closest("form")!);

    await waitFor(() => expect(updateUserRoles).toHaveBeenCalledTimes(1));
    expect(updateUserRoles).toHaveBeenCalledWith("test-token", "user-1", [
      "member",
      "admin",
    ]);
    // order: updateUser fired before updateUserRoles
    expect(updateUser.mock.invocationCallOrder[0]).toBeLessThan(
      updateUserRoles.mock.invocationCallOrder[0]
    );
    // a refresh getUser is fired after the update (call count grows)
    await waitFor(() =>
      expect(getUser.mock.calls.length).toBeGreaterThan(getUserCallsBefore)
    );
    expect(await screen.findByText("userUpdated")).toBeInTheDocument();
  });

  it("editing the emailVerified checkbox is reflected in the updateUser payload", async () => {
    renderWithClient();
    await screen.findByText("editUser");

    fireEvent.click(screen.getByRole("checkbox", { name: "emailVerified" }));
    fireEvent.submit(screen.getByLabelText("email *").closest("form")!);

    await waitFor(() => expect(updateUser).toHaveBeenCalledTimes(1));
    expect(updateUser.mock.calls[0][2].emailVerified).toBe(true);
  });

  // ---- SUBMIT ERROR ------------------------------------------------------
  it("surfaces a submit error in the dismissible banner and shows no success", async () => {
    updateUser.mockRejectedValue(new Error("update boom"));

    renderWithClient();
    await screen.findByText("editUser");

    fireEvent.submit(screen.getByLabelText("email *").closest("form")!);

    expect(await screen.findByText("update boom")).toBeInTheDocument();
    expect(screen.queryByText("userUpdated")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "×" }));
    await waitFor(() =>
      expect(screen.queryByText("update boom")).not.toBeInTheDocument()
    );
  });

  // ---- NAVIGATION --------------------------------------------------------
  it("the cancel button navigates back to /admin/users", async () => {
    renderWithClient();
    await screen.findByText("editUser");

    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    expect(push).toHaveBeenCalledWith("/admin/users");
  });
});
