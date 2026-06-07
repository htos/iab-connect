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

// REQ-058 (E8-S1) AC-1/2/3: the credentials page lists clients, exposes scope checkboxes, surfaces
// the create response secret in a show-once panel, and hides revoke on already-revoked clients.

// A64: stable identity translations mock.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const apiGet = vi.fn();
const apiPost = vi.fn();
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    isAdmin: true,
    accessToken: "test-token",
  }),
  useApiClient: () => ({ get: apiGet, post: apiPost }),
}));

import ApiClientsPage from "./page";

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
    render(<ApiClientsPage />);
    await waitFor(() =>
      expect(screen.getByText("Partner A")).toBeInTheDocument()
    );
  });

  it("renders scope checkboxes in the create dialog", async () => {
    mockList([]);
    render(<ApiClientsPage />);
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
    render(<ApiClientsPage />);
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
    render(<ApiClientsPage />);
    await waitFor(() =>
      expect(screen.getByText("Revoked One")).toBeInTheDocument()
    );
    expect(screen.queryByText("revoke")).not.toBeInTheDocument();
    expect(screen.getByText("revoked")).toBeInTheDocument();
  });
});
