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
 * E27-S1 — Characterization (regression net) for the ADMIN USERS CREATE page
 * (REQ-002, src/app/admin/users/new/page.tsx).
 *
 * Pins CURRENT observable behaviour BEFORE refactor. Legacy transport:
 * `getAvailableRoles` (loaded into a checkbox list on mount) + `createUser`,
 * both token-param functions from `@/lib/api/users` over useState/useEffect.
 * No useApiClient / TanStack — the QueryClientProvider wrapper is inert here.
 *
 * i18n: `useTranslations("users")` + `useTranslations("common")`, identity
 * translator, so t("createUser") === "createUser", tCommon("cancel") === "cancel".
 *
 * // A79 deltas:
 * - Plain useState/useEffect: no provider retry / double-fetch to record.
 * - GATED PATH QUIRK: on the non-admin path the roles-fetch effect never runs
 *   so `isLoading` stays its initial `true` → the page renders ONLY the spinner
 *   (form never mounts). Redirect effect fires router.push("/") in parallel.
 *   Pinned: assert redirect + that the form / createUser never appear.
 * - On a submit error the handler sets isSaving=false in `finally`; the form
 *   fields retain their values (no reset-on-error), pinned implicitly by the
 *   re-submit-after-409 not being exercised.
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

const createUser = vi.fn();
const getAvailableRoles = vi.fn();
vi.mock("@/lib/api/users", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api/users")>("@/lib/api/users");
  return {
    ...actual,
    createUser: (...args: unknown[]) => createUser(...args),
    getAvailableRoles: (...args: unknown[]) => getAvailableRoles(...args),
  };
});

import CreateUserPage from "./page";

const ROLES = [
  { name: "member", description: "Mitglied" },
  { name: "admin", description: "Administrator" },
];

function renderWithClient() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <CreateUserPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  getAvailableRoles.mockResolvedValue(ROLES);
  createUser.mockResolvedValue({ id: "new-user-99" });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isAdmin = true;
  authState.accessToken = "test-token";
  authState.isLoading = false;
});

describe("admin/users/new CREATE — characterization (E27-S1)", () => {
  // ---- AC-1 GUARD --------------------------------------------------------
  it("redirects an authenticated NON-admin to / and never loads roles / form", async () => {
    authState.isAdmin = false;

    renderWithClient();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(getAvailableRoles).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });

  it("redirects an UNAUTHENTICATED user to / and never loads roles", async () => {
    authState.isAuthenticated = false;
    authState.isAdmin = false;

    renderWithClient();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(getAvailableRoles).not.toHaveBeenCalled();
  });

  // ---- LOAD --------------------------------------------------------------
  it("loads available roles and renders a checkbox per role with member pre-checked", async () => {
    renderWithClient();

    // form renders once roles resolve (isLoading=false)
    expect(await screen.findByLabelText("email *")).toBeInTheDocument();
    expect(getAvailableRoles).toHaveBeenCalledWith("test-token");

    // default roles === ["member"]: member checkbox checked, admin unchecked
    const memberCb = screen.getByRole("checkbox", { name: /member/i });
    const adminCb = screen.getByRole("checkbox", { name: /admin/i });
    expect(memberCb).toBeChecked();
    expect(adminCb).not.toBeChecked();
  });

  it("hides the temporaryPassword field by default (sendInvitation defaults to true)", async () => {
    renderWithClient();
    await screen.findByLabelText("email *");

    expect(
      screen.queryByLabelText("temporaryPassword *")
    ).not.toBeInTheDocument();
  });

  it("reveals the temporaryPassword field when sendInvitation is unchecked", async () => {
    renderWithClient();
    await screen.findByLabelText("email *");

    fireEvent.click(
      screen.getByRole("checkbox", { name: "sendInvitationEmail" })
    );
    expect(screen.getByLabelText("temporaryPassword *")).toBeInTheDocument();
  });

  // ---- VALIDATION --------------------------------------------------------
  it("blocks submit with the emailRequired message when email is empty", async () => {
    renderWithClient();
    await screen.findByLabelText("email *");

    // submit the form directly (bypass the native `required` attribute)
    fireEvent.submit(screen.getByLabelText("email *").closest("form")!);

    expect(await screen.findByText("emailRequired")).toBeInTheDocument();
    expect(createUser).not.toHaveBeenCalled();
  });

  it("blocks submit with passwordOrInvitationRequired when !sendInvitation and no password", async () => {
    renderWithClient();
    await screen.findByLabelText("email *");

    fireEvent.change(screen.getByLabelText("email *"), {
      target: { value: "x@y.example" },
    });
    fireEvent.click(
      screen.getByRole("checkbox", { name: "sendInvitationEmail" })
    );
    // leave temporaryPassword empty
    fireEvent.submit(screen.getByLabelText("email *").closest("form")!);

    expect(
      await screen.findByText("passwordOrInvitationRequired")
    ).toBeInTheDocument();
    expect(createUser).not.toHaveBeenCalled();
  });

  // ---- SUBMIT SUCCESS ----------------------------------------------------
  it("submits via createUser then redirects to /admin/users/{newId}", async () => {
    renderWithClient();
    await screen.findByLabelText("email *");

    fireEvent.change(screen.getByLabelText("email *"), {
      target: { value: "new@user.example" },
    });
    fireEvent.submit(screen.getByLabelText("email *").closest("form")!);

    await waitFor(() => expect(createUser).toHaveBeenCalledTimes(1));
    const [token, request] = createUser.mock.calls[0];
    expect(token).toBe("test-token");
    expect(request).toMatchObject({
      email: "new@user.example",
      enabled: true,
      sendInvitation: true,
      roles: ["member"],
    });
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/admin/users/new-user-99")
    );
  });

  it("toggling a role checkbox is reflected in the createUser roles payload", async () => {
    renderWithClient();
    await screen.findByLabelText("email *");

    fireEvent.change(screen.getByLabelText("email *"), {
      target: { value: "multi@role.example" },
    });
    // add admin on top of the default member
    fireEvent.click(screen.getByRole("checkbox", { name: /admin/i }));
    fireEvent.submit(screen.getByLabelText("email *").closest("form")!);

    await waitFor(() => expect(createUser).toHaveBeenCalledTimes(1));
    expect(createUser.mock.calls[0][1].roles).toEqual(["member", "admin"]);
  });

  // ---- SUBMIT ERROR ------------------------------------------------------
  it("surfaces the 409 duplicate-email message verbatim on conflict", async () => {
    createUser.mockRejectedValue(
      new Error("A user with this email already exists")
    );

    renderWithClient();
    await screen.findByLabelText("email *");

    fireEvent.change(screen.getByLabelText("email *"), {
      target: { value: "dupe@user.example" },
    });
    fireEvent.submit(screen.getByLabelText("email *").closest("form")!);

    expect(
      await screen.findByText("A user with this email already exists")
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalledWith(
      expect.stringContaining("/admin/users/")
    );
  });

  it("surfaces a generic submit error in the dismissible banner", async () => {
    createUser.mockRejectedValue(new Error("create boom"));

    renderWithClient();
    await screen.findByLabelText("email *");

    fireEvent.change(screen.getByLabelText("email *"), {
      target: { value: "boom@user.example" },
    });
    fireEvent.submit(screen.getByLabelText("email *").closest("form")!);

    expect(await screen.findByText("create boom")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "×" }));
    await waitFor(() =>
      expect(screen.queryByText("create boom")).not.toBeInTheDocument()
    );
  });

  // ---- NAVIGATION --------------------------------------------------------
  it("the cancel button navigates back to /admin/users", async () => {
    renderWithClient();
    await screen.findByLabelText("email *");

    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    expect(push).toHaveBeenCalledWith("/admin/users");
  });
});
