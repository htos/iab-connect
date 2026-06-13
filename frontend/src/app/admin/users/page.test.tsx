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
 * E27-S1 — Characterization (regression net) for the ADMIN USERS LIST page
 * (REQ-002, src/app/admin/users/page.tsx).
 *
 * Pins CURRENT observable behaviour BEFORE the feature-slice refactor. The page
 * uses the legacy transport: token-param functions from `@/features/admin-users/api/users-admin`
 * (getUsers, setUserEnabled, sendPasswordReset, resetUserMfa, deleteUser) over
 * raw useState/useEffect — NOT useApiClient / TanStack. So we mock that module
 * at the boundary. The QueryClientProvider wrapper is kept for harness
 * consistency (A64/A78) but the page does not consume it.
 *
 * i18n: `useTranslations("users")` and `useTranslations("common")` — identity
 * translator means t("title") === "title", tCommon("search") === "search".
 * Browser dialogs: the page uses window.confirm / window.alert — stubbed per test.
 *
 * // A79 deltas:
 * - The page is plain useState/useEffect (no provider retry, no TanStack
 *   refetch double-fire) so the retry:false QueryClient is inert here — no
 *   provider-driven double-fetch to record.
 * - GATED PATH QUIRK: when the user is NOT (auth && admin), the data-fetch
 *   effect never runs, so `isLoading` stays its initial `true` forever and the
 *   page renders ONLY the spinner (never the table). The redirect effect fires
 *   router.push("/") in parallel. This suite pins that reality: on the
 *   non-admin path we assert the redirect + that getUsers was never called, and
 *   that the table/heading never render.
 * - The enable/disable, password-reset and mfa-reset handlers do not optimistic
 *   -update or refetch the list; only delete mutates local state. Pinned as-is.
 */

// A64: identity translations (key in == key out), one stable translator.
vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

// A78: STABLE router mock so push() is assertable.
const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
}));

// next/link: pass-through children.
vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// A78: MUTABLE auth state to exercise the admin guard per-test.
const authState = {
  isAuthenticated: true,
  isLoading: false,
  isAdmin: true,
  accessToken: "test-token",
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
}));

// Transport boundary: mock the token-param functions the page actually imports.
// getRoleDisplayName / getRoleColor are PURE — keep the real implementations so
// role-badge labels/colours reflect production logic.
const getUsers = vi.fn();
const setUserEnabled = vi.fn();
const sendPasswordReset = vi.fn();
const resetUserMfa = vi.fn();
const deleteUser = vi.fn();
vi.mock("@/features/admin-users/api/users-admin", async () => {
  const actual =
    await vi.importActual<typeof import("@/features/admin-users/api/users-admin")>("@/features/admin-users/api/users-admin");
  return {
    ...actual,
    getUsers: (...args: unknown[]) => getUsers(...args),
    setUserEnabled: (...args: unknown[]) => setUserEnabled(...args),
    sendPasswordReset: (...args: unknown[]) => sendPasswordReset(...args),
    resetUserMfa: (...args: unknown[]) => resetUserMfa(...args),
    deleteUser: (...args: unknown[]) => deleteUser(...args),
  };
});

import UsersPage from "./page";
import type { User } from "@/features/admin-users/api/users-admin";

function makeUser(over: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "anna@alpha.example",
    firstName: "Anna",
    lastName: "Alpha",
    enabled: true,
    emailVerified: true,
    createdAt: "2024-01-15T10:00:00Z",
    roles: ["admin"],
    ...over,
  };
}

const ADMIN_USER = makeUser({
  id: "user-1",
  email: "anna@alpha.example",
  firstName: "Anna",
  lastName: "Alpha",
  enabled: true,
  emailVerified: true,
  roles: ["admin"],
});
const MEMBER_USER = makeUser({
  id: "user-2",
  email: "bert@beta.example",
  firstName: "Bert",
  lastName: "Beta",
  enabled: false,
  emailVerified: false,
  roles: ["member"],
});

function listResponse(users: User[], totalCount = users.length) {
  return { users, totalCount, page: 1, pageSize: 20 };
}

function renderWithClient() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <UsersPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  getUsers.mockResolvedValue(listResponse([ADMIN_USER, MEMBER_USER], 2));
  setUserEnabled.mockResolvedValue(makeUser({ ...ADMIN_USER, enabled: false }));
  sendPasswordReset.mockResolvedValue(undefined);
  resetUserMfa.mockResolvedValue(undefined);
  deleteUser.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isAdmin = true;
  authState.accessToken = "test-token";
  authState.isLoading = false;
});

describe("admin/users LIST — characterization (E27-S1)", () => {
  // ---- AC-1 GUARD --------------------------------------------------------
  it("redirects an authenticated NON-admin to / and never fetches users", async () => {
    authState.isAuthenticated = true;
    authState.isAdmin = false;

    renderWithClient();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(getUsers).not.toHaveBeenCalled();
    // gated path: isLoading stays true → only the spinner, no table heading
    expect(screen.queryByText("title")).not.toBeInTheDocument();
  });

  it("redirects an UNAUTHENTICATED user to / and never fetches users", async () => {
    authState.isAuthenticated = false;
    authState.isAdmin = false;

    renderWithClient();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(getUsers).not.toHaveBeenCalled();
  });

  it("does NOT redirect while auth is still loading", async () => {
    authState.isLoading = true;

    renderWithClient();

    // allow effects to flush
    await Promise.resolve();
    expect(push).not.toHaveBeenCalledWith("/");
  });

  // ---- LOAD --------------------------------------------------------------
  it("loads users via GET-equivalent getUsers(token,{page,pageSize}) and renders a row per user", async () => {
    renderWithClient();

    expect(await screen.findByText("Anna Alpha")).toBeInTheDocument();
    expect(screen.getByText("Bert Beta")).toBeInTheDocument();
    expect(getUsers).toHaveBeenCalledWith("test-token", {
      search: undefined,
      page: 1,
      pageSize: 20,
    });
  });

  it("shows the total-user count and the page title", async () => {
    renderWithClient();
    await screen.findByText("Anna Alpha");

    expect(screen.getByText("title")).toBeInTheDocument();
    expect(screen.getByText("totalUsers")).toBeInTheDocument();
  });

  // ---- SEARCH (explicit submit) -----------------------------------------
  it("submitting the search form refetches with the search term and resets page=1", async () => {
    renderWithClient();
    await screen.findByText("Anna Alpha");

    // NOTE (A79): typing re-runs the load effect (fetchUsers is in the effect
    // deps and closes over `search`), so the page briefly flips to the spinner.
    // Capture the form before mutating, then wait for the search-bearing call.
    const input = screen.getByPlaceholderText("searchPlaceholder");
    const form = input.closest("form")!;
    fireEvent.change(input, { target: { value: "anna" } });
    fireEvent.submit(form);

    await waitFor(() =>
      expect(getUsers).toHaveBeenLastCalledWith("test-token", {
        search: "anna",
        page: 1,
        pageSize: 20,
      })
    );
  });

  // ---- PAGINATION --------------------------------------------------------
  it("does NOT render pagination when totalPages === 1 (count <= pageSize)", async () => {
    getUsers.mockResolvedValue(listResponse([ADMIN_USER], 1));

    renderWithClient();
    await screen.findByText("Anna Alpha");

    expect(
      screen.queryByRole("button", { name: "previous" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "next" })
    ).not.toBeInTheDocument();
  });

  it("renders pagination (Prev disabled at page 1, Next enabled) when totalCount > pageSize", async () => {
    getUsers.mockResolvedValue(listResponse([ADMIN_USER, MEMBER_USER], 45));

    renderWithClient();
    await screen.findByText("Anna Alpha");

    expect(screen.getByRole("button", { name: "previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "next" })).toBeEnabled();
    // "1 / 3" page indicator (45 / 20 = 3 pages)
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("clicking Next advances the page and refetches with page=2", async () => {
    getUsers.mockResolvedValue(listResponse([ADMIN_USER, MEMBER_USER], 45));

    renderWithClient();
    await screen.findByText("Anna Alpha");

    fireEvent.click(screen.getByRole("button", { name: "next" }));

    await waitFor(() =>
      expect(getUsers).toHaveBeenLastCalledWith("test-token", {
        search: undefined,
        page: 2,
        pageSize: 20,
      })
    );
  });

  // ---- EMPTY / ERROR -----------------------------------------------------
  it("renders the noUsers empty state when the list is empty and there is no search", async () => {
    getUsers.mockResolvedValue(listResponse([], 0));

    renderWithClient();

    expect(await screen.findByText("noUsers")).toBeInTheDocument();
    expect(screen.queryByText("noUsersFound")).not.toBeInTheDocument();
  });

  it("renders the noUsersFound empty state when a search yields nothing", async () => {
    renderWithClient();
    await screen.findByText("Anna Alpha");

    // type a search term, then return an empty list on submit
    getUsers.mockResolvedValue(listResponse([], 0));
    const input = screen.getByPlaceholderText("searchPlaceholder");
    const form = input.closest("form")!;
    fireEvent.change(input, { target: { value: "zzz" } });
    fireEvent.submit(form);

    expect(await screen.findByText("noUsersFound")).toBeInTheDocument();
  });

  it("surfaces a load error in a dismissible banner", async () => {
    getUsers.mockRejectedValue(new Error("Boom load"));

    renderWithClient();

    expect(await screen.findByText("Boom load")).toBeInTheDocument();
    // dismiss
    fireEvent.click(screen.getByRole("button", { name: "×" }));
    await waitFor(() =>
      expect(screen.queryByText("Boom load")).not.toBeInTheDocument()
    );
  });

  // ---- ROLE / STATUS / VERIFIED BADGES ----------------------------------
  it("renders the translated role label per row (admin → Administrator, member → Mitglied)", async () => {
    renderWithClient();
    await screen.findByText("Anna Alpha");

    const adminRow = screen.getByText("Anna Alpha").closest("tr")!;
    expect(within(adminRow).getByText("Administrator")).toBeInTheDocument();

    const memberRow = screen.getByText("Bert Beta").closest("tr")!;
    expect(within(memberRow).getByText("Mitglied")).toBeInTheDocument();
  });

  it("renders the status badge (active green / inactive red) and the emailVerified check", async () => {
    renderWithClient();
    await screen.findByText("Anna Alpha");

    const adminRow = screen.getByText("Anna Alpha").closest("tr")!;
    const activeBadge = within(adminRow).getByText("active");
    expect(activeBadge.className).toContain("bg-green-100");
    expect(activeBadge.className).toContain("text-green-800");
    // emailVerified ✓ present for the verified admin user
    expect(within(adminRow).getByText("✓")).toBeInTheDocument();

    const memberRow = screen.getByText("Bert Beta").closest("tr")!;
    const inactiveBadge = within(memberRow).getByText("inactive");
    expect(inactiveBadge.className).toContain("bg-red-100");
    expect(inactiveBadge.className).toContain("text-red-800");
    // emailVerified false → no ✓ in that row
    expect(within(memberRow).queryByText("✓")).not.toBeInTheDocument();
  });

  // ---- ENABLE / DISABLE TOGGLE (no confirm; conditional colour) ----------
  it("the disable button on an ENABLED row is red (text-red-600), no confirm; toggles via setUserEnabled(false)", async () => {
    getUsers.mockResolvedValue(listResponse([ADMIN_USER], 1));
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderWithClient();
    await screen.findByText("Anna Alpha");

    const toggle = screen.getByTitle("disable");
    expect(toggle.className).toContain("text-red-600");

    fireEvent.click(toggle);

    await waitFor(() =>
      expect(setUserEnabled).toHaveBeenCalledWith("test-token", "user-1", false)
    );
    // AC: no confirm dialog for enable/disable
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("the enable button on a DISABLED row is green (text-green-600); toggles via setUserEnabled(true)", async () => {
    getUsers.mockResolvedValue(listResponse([MEMBER_USER], 1));
    setUserEnabled.mockResolvedValue(
      makeUser({ ...MEMBER_USER, enabled: true })
    );

    renderWithClient();
    await screen.findByText("Bert Beta");

    const toggle = screen.getByTitle("enable");
    expect(toggle.className).toContain("text-green-600");

    fireEvent.click(toggle);

    await waitFor(() =>
      expect(setUserEnabled).toHaveBeenCalledWith("test-token", "user-2", true)
    );
  });

  it("AC-8: a failed enable/disable surfaces the error in the banner", async () => {
    getUsers.mockResolvedValue(listResponse([ADMIN_USER], 1));
    setUserEnabled.mockRejectedValue(new Error("toggle failed"));

    renderWithClient();
    await screen.findByText("Anna Alpha");

    fireEvent.click(screen.getByTitle("disable"));

    expect(await screen.findByText("toggle failed")).toBeInTheDocument();
  });

  // ---- PASSWORD RESET (confirm + success alert; blue) --------------------
  it("password-reset button is blue (text-blue-600); confirm→success path calls sendPasswordReset + alerts", async () => {
    getUsers.mockResolvedValue(listResponse([ADMIN_USER], 1));
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    renderWithClient();
    await screen.findByText("Anna Alpha");

    const btn = screen.getByTitle("resetPassword");
    expect(btn.className).toContain("text-blue-600");
    fireEvent.click(btn);

    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() =>
      expect(sendPasswordReset).toHaveBeenCalledWith("test-token", "user-1")
    );
    expect(alertSpy).toHaveBeenCalledWith("passwordResetSent");
  });

  it("password-reset is aborted (no transport call) when confirm is cancelled", async () => {
    getUsers.mockResolvedValue(listResponse([ADMIN_USER], 1));
    vi.spyOn(window, "confirm").mockReturnValue(false);

    renderWithClient();
    await screen.findByText("Anna Alpha");

    fireEvent.click(screen.getByTitle("resetPassword"));
    expect(sendPasswordReset).not.toHaveBeenCalled();
  });

  it("AC-8: a failed password-reset surfaces the error in the banner (no alert)", async () => {
    getUsers.mockResolvedValue(listResponse([ADMIN_USER], 1));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    sendPasswordReset.mockRejectedValue(new Error("pwd reset failed"));

    renderWithClient();
    await screen.findByText("Anna Alpha");

    fireEvent.click(screen.getByTitle("resetPassword"));

    expect(await screen.findByText("pwd reset failed")).toBeInTheDocument();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  // ---- MFA RESET (confirm + success alert; orange) -----------------------
  it("mfa-reset button is orange (text-orange-600); confirm→success path calls resetUserMfa + alerts", async () => {
    getUsers.mockResolvedValue(listResponse([ADMIN_USER], 1));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    renderWithClient();
    await screen.findByText("Anna Alpha");

    const btn = screen.getByTitle("resetMfa");
    expect(btn.className).toContain("text-orange-600");
    fireEvent.click(btn);

    await waitFor(() =>
      expect(resetUserMfa).toHaveBeenCalledWith("test-token", "user-1")
    );
    expect(alertSpy).toHaveBeenCalledWith("mfaResetSent");
  });

  it("AC-8: a failed mfa-reset surfaces the error in the banner", async () => {
    getUsers.mockResolvedValue(listResponse([ADMIN_USER], 1));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "alert").mockImplementation(() => {});
    resetUserMfa.mockRejectedValue(new Error("mfa failed"));

    renderWithClient();
    await screen.findByText("Anna Alpha");

    fireEvent.click(screen.getByTitle("resetMfa"));

    expect(await screen.findByText("mfa failed")).toBeInTheDocument();
  });

  // ---- DELETE (confirm, no alert; red; row filtered + totalCount-- ) -----
  it("delete button is red (text-red-600); confirm→success removes the row and decrements the count", async () => {
    getUsers.mockResolvedValue(listResponse([ADMIN_USER, MEMBER_USER], 2));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    renderWithClient();
    await screen.findByText("Anna Alpha");

    const adminRow = screen.getByText("Anna Alpha").closest("tr")!;
    const del = within(adminRow).getByTitle("delete");
    expect(del.className).toContain("text-red-600");
    fireEvent.click(del);

    await waitFor(() =>
      expect(deleteUser).toHaveBeenCalledWith("test-token", "user-1")
    );
    // row removed
    await waitFor(() =>
      expect(screen.queryByText("Anna Alpha")).not.toBeInTheDocument()
    );
    expect(screen.getByText("Bert Beta")).toBeInTheDocument();
    // delete fires no success alert
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("delete is aborted when confirm is cancelled (no transport call, row preserved)", async () => {
    getUsers.mockResolvedValue(listResponse([ADMIN_USER], 1));
    vi.spyOn(window, "confirm").mockReturnValue(false);

    renderWithClient();
    await screen.findByText("Anna Alpha");

    fireEvent.click(
      within(screen.getByText("Anna Alpha").closest("tr")!).getByTitle("delete")
    );

    expect(deleteUser).not.toHaveBeenCalled();
    expect(screen.getByText("Anna Alpha")).toBeInTheDocument();
  });

  it("AC-8: a FAILED delete preserves the list and surfaces the error", async () => {
    getUsers.mockResolvedValue(listResponse([ADMIN_USER], 1));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    deleteUser.mockRejectedValue(new Error("delete failed"));

    renderWithClient();
    await screen.findByText("Anna Alpha");

    fireEvent.click(
      within(screen.getByText("Anna Alpha").closest("tr")!).getByTitle("delete")
    );

    expect(await screen.findByText("delete failed")).toBeInTheDocument();
    // list preserved on failure
    expect(screen.getByText("Anna Alpha")).toBeInTheDocument();
  });

  // ---- NAVIGATION --------------------------------------------------------
  it("the create-user header button navigates to /admin/users/new", async () => {
    renderWithClient();
    await screen.findByText("Anna Alpha");

    fireEvent.click(screen.getByRole("button", { name: "createUser" }));
    expect(push).toHaveBeenCalledWith("/admin/users/new");
  });

  it("the row edit button navigates to /admin/users/{id}", async () => {
    getUsers.mockResolvedValue(listResponse([ADMIN_USER], 1));
    renderWithClient();
    await screen.findByText("Anna Alpha");

    fireEvent.click(screen.getByTitle("edit"));
    expect(push).toHaveBeenCalledWith("/admin/users/user-1");
  });
});
