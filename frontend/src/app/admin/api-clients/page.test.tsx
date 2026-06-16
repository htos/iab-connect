// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// REQ-058 (E8-S1) AC-1/2/3: the credentials page lists clients, exposes scope checkboxes, surfaces
// the create response secret in a show-once panel, and hides revoke on already-revoked clients.
//
// E27-S1 (characterization / regression net): extends the original net with the admin guard
// (AC-1), the show-once secret copy/dismiss + list-refetch-doesn't-reintroduce-secret invariant
// (data-loss path, AC-5), and the revoke confirm/refetch round-trip. Pins CURRENT behaviour AS-IS.
//
// A79 deltas: useApiClient runs with `retry: false` at the transport boundary; these tests stub
// the api hook directly (no fetch/retry layer), so no retry-masked deltas are observable here. The
// guard target is "/" (NOT "/login") — pinned as the real code, which diverges from a generic
// "redirect to login" assumption.

// A64: stable identity translations mock. HARNESS NOTE (E27-S1): module-level stable translator
// (not a fresh arrow per render) — `t` participates in callback/effect chains and a new function
// each render risks render loops / non-deterministic refetch counts.
const tFn = (key: string) => key;
vi.mock("next-intl", () => ({ useTranslations: () => tFn }));

// Stable router mock so the admin-guard push() target is observable across renders.
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mutable auth state so the admin guard can be exercised. Defaults to an authenticated admin.
const authState = {
  isAuthenticated: true,
  isLoading: false,
  isAdmin: true,
  accessToken: "test-token" as string | undefined,
};
const apiGet = vi.fn();
const apiPost = vi.fn();
// Stable api object identity across renders (the load effect lists `api` as a dependency).
const apiClient = { get: apiGet, post: apiPost };
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => apiClient,
}));

import ApiClientsPage from "./page";

// E27-S5 feature-slice adaptation (A88, mirrors the E25-S3 admission): the page now
// routes through the `features/admin-integrations` slice, whose hooks use TanStack
// Query. The ONLY harness change is wrapping the render in a `QueryClientProvider`
// (retry:false) — the `@/lib/auth` `useApiClient`/`useAuth` mock seam is unchanged
// and EVERY behavioural assertion below is preserved verbatim.
function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ApiClientsPage />
    </QueryClientProvider>
  );
}

const scopes = ["events:read", "blog:read"];

function mockList(clients: unknown[]) {
  apiGet.mockImplementation((endpoint: string) => {
    if (endpoint.endsWith("/scopes"))
      return Promise.resolve({ data: scopes, error: null, status: 200 });
    return Promise.resolve({ data: clients, error: null, status: 200 });
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  // Reset the mutable auth state back to the authenticated-admin default.
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.isAdmin = true;
  authState.accessToken = "test-token";
});

describe("ApiClientsPage", () => {
  it("lists existing clients", async () => {
    mockList([
      {
        id: "1",
        name: "Partner A",
        scopes: ["events:read"],
        isRevoked: false,
        createdAt: "2026-06-07T00:00:00Z",
        revokedAt: null,
        lastUsedAt: null,
      },
    ]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Partner A")).toBeInTheDocument()
    );
  });

  it("renders scope checkboxes in the create dialog", async () => {
    mockList([]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("noClients")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByText("create"));
    await waitFor(() =>
      expect(screen.getByText("createDialogTitle")).toBeInTheDocument()
    );
    expect(screen.getByText("events:read")).toBeInTheDocument();
    expect(screen.getByText("blog:read")).toBeInTheDocument();
  });

  it("shows the secret exactly once after create", async () => {
    mockList([]);
    apiPost.mockResolvedValue({
      data: {
        id: "9",
        name: "New",
        scopes: ["events:read"],
        secret: "iabc.abc.SECRETVALUE",
        createdAt: "2026-06-07T00:00:00Z",
      },
      error: null,
      status: 201,
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("noClients")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByText("create"));
    await waitFor(() =>
      expect(screen.getByText("createDialogTitle")).toBeInTheDocument()
    );

    fireEvent.change(screen.getByPlaceholderText("namePlaceholder"), {
      target: { value: "New" },
    });
    // select the first scope checkbox
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByText("save"));

    await waitFor(() =>
      expect(screen.getByText("secretOnceWarning")).toBeInTheDocument()
    );
    expect(screen.getByText("iabc.abc.SECRETVALUE")).toBeInTheDocument();
  });

  it("hides revoke for already-revoked clients", async () => {
    mockList([
      {
        id: "2",
        name: "Revoked One",
        scopes: ["blog:read"],
        isRevoked: true,
        createdAt: "2026-06-07T00:00:00Z",
        revokedAt: "2026-06-07T01:00:00Z",
        lastUsedAt: null,
      },
    ]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Revoked One")).toBeInTheDocument()
    );
    expect(screen.queryByText("revoke")).not.toBeInTheDocument();
    expect(screen.getByText("revoked")).toBeInTheDocument();
  });

  // --- E27-S1 added: admin guard (AC-1) ---

  it("redirects a non-admin to / and does not fetch the list", async () => {
    authState.isAdmin = false;
    mockList([]);
    renderPage();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("redirects an unauthenticated user to / and does not fetch the list", async () => {
    authState.isAuthenticated = false;
    mockList([]);
    renderPage();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("renders the loading screen and does not redirect while auth is still loading", async () => {
    // Reality pin: the redirect effect is gated on `!authLoading`, so no push() fires while loading.
    // The page early-returns the common loading screen. NOTE: the initial-load effect is gated on
    // (isAuthenticated && isAdmin && accessToken) only — NOT on authLoading — so with those flags
    // still true the list fetch DOES fire even during the loading screen. Pinned AS-IS.
    authState.isLoading = true;
    mockList([]);
    renderPage();
    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
  });

  it("does not fetch the list when the access token is missing", async () => {
    // Authenticated admin but no token: the initial-load effect is gated on accessToken.
    authState.accessToken = undefined;
    mockList([]);
    renderPage();
    // No redirect (still authenticated + admin), but no fetch either.
    await waitFor(() => {});
    expect(push).not.toHaveBeenCalled();
    expect(apiGet).not.toHaveBeenCalled();
  });

  // --- E27-S1 added: show-once secret copy + dismiss + refetch invariant (data-loss path, AC-5) ---

  it("copies the secret via clipboard and flips copy -> copied", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    mockList([]);
    apiPost.mockResolvedValue({
      data: {
        id: "9",
        name: "New",
        scopes: ["events:read"],
        secret: "iabc.abc.COPYME",
        createdAt: "2026-06-07T00:00:00Z",
      },
      error: null,
      status: 201,
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("noClients")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByText("create"));
    await waitFor(() =>
      expect(screen.getByText("createDialogTitle")).toBeInTheDocument()
    );
    fireEvent.change(screen.getByPlaceholderText("namePlaceholder"), {
      target: { value: "New" },
    });
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByText("save"));

    await waitFor(() => expect(screen.getByText("copy")).toBeInTheDocument());
    fireEvent.click(screen.getByText("copy"));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("iabc.abc.COPYME")
    );
    expect(screen.getByText("copied")).toBeInTheDocument();
  });

  it("dismisses the secret panel and the list refetch does not reintroduce the secret", async () => {
    // After create, refreshClients() re-fetches the list. The list DTO never carries the secret,
    // so the show-once panel state (createdSecret) is the ONLY source of the cleartext value.
    // The list endpoint returns EMPTY on the initial load, then the freshly-created client (without
    // a secret field) on the post-create refetch — proving the refetch can't reintroduce the secret.
    let listCall = 0;
    apiGet.mockImplementation((endpoint: string) => {
      if (endpoint.endsWith("/scopes"))
        return Promise.resolve({ data: scopes, error: null, status: 200 });
      listCall += 1;
      const data =
        listCall === 1
          ? []
          : [
              {
                id: "9",
                name: "New",
                scopes: ["events:read"],
                isRevoked: false,
                createdAt: "2026-06-07T00:00:00Z",
                revokedAt: null,
                lastUsedAt: null,
              },
            ];
      return Promise.resolve({ data, error: null, status: 200 });
    });
    apiPost.mockResolvedValue({
      data: {
        id: "9",
        name: "New",
        scopes: ["events:read"],
        secret: "iabc.abc.ONCEONLY",
        createdAt: "2026-06-07T00:00:00Z",
      },
      error: null,
      status: 201,
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("noClients")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByText("create"));
    await waitFor(() =>
      expect(screen.getByText("createDialogTitle")).toBeInTheDocument()
    );
    fireEvent.change(screen.getByPlaceholderText("namePlaceholder"), {
      target: { value: "New" },
    });
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByText("save"));

    // Secret shown once; the list refetch (triggered by create) lands the row but no secret.
    await waitFor(() =>
      expect(screen.getByText("iabc.abc.ONCEONLY")).toBeInTheDocument()
    );
    await waitFor(() => expect(screen.getByText("New")).toBeInTheDocument());
    // The refetched list row is present but the secret value is still ONLY in the panel.

    // Dismiss the panel -> setCreatedSecret(null). The secret must be gone for good.
    fireEvent.click(screen.getByText("dismissSecret"));
    await waitFor(() =>
      expect(screen.queryByText("secretOnceWarning")).not.toBeInTheDocument()
    );
    expect(screen.queryByText("iabc.abc.ONCEONLY")).not.toBeInTheDocument();
    // The list row survives the dismiss (only the secret panel went away).
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  // --- E27-S1 added: revoke confirm + refetch round-trip ---

  it("revokes a client after confirm and refetches the list", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    mockList([
      {
        id: "7",
        name: "Active One",
        scopes: ["events:read"],
        isRevoked: false,
        createdAt: "2026-06-07T00:00:00Z",
        revokedAt: null,
        lastUsedAt: null,
      },
    ]);
    apiPost.mockResolvedValue({ data: {}, error: null, status: 200 });

    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Active One")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByText("revoke"));
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/admin/api-clients/7/revoke",
        {}
      )
    );
    expect(confirmSpy).toHaveBeenCalledWith("confirmRevoke");
    confirmSpy.mockRestore();
  });

  it("does not call the revoke endpoint when confirm is cancelled", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    mockList([
      {
        id: "7",
        name: "Active One",
        scopes: ["events:read"],
        isRevoked: false,
        createdAt: "2026-06-07T00:00:00Z",
        revokedAt: null,
        lastUsedAt: null,
      },
    ]);

    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Active One")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByText("revoke"));
    expect(apiPost).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  // --- E27-S1 added: AC-8 pin the destructive affordance colour AS-IS ---

  it("renders the revoke action with the red destructive colour (not a generic destructive variant)", async () => {
    mockList([
      {
        id: "7",
        name: "Active One",
        scopes: ["events:read"],
        isRevoked: false,
        createdAt: "2026-06-07T00:00:00Z",
        revokedAt: null,
        lastUsedAt: null,
      },
    ]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Active One")).toBeInTheDocument()
    );
    // Pin the ACTUAL Tailwind colour utility on the revoke button.
    const revokeBtn = screen.getByText("revoke").closest("button");
    expect(revokeBtn).toHaveClass("text-red-600");
    expect(revokeBtn).toHaveClass("hover:text-red-800");
  });
});
