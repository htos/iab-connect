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

// E26-S1 (S2 ledger/accounting) — characterization net for finance/accounts.
//
// A56 note: guard CONFIRMED lean role-only — reads canReadFinance ONLY (no isAuthenticated /
// authLoading); router.replace("/"); `if (!canReadFinance) return null`. No DoubleEntry mode guard.
//
// A79 deltas:
//  - AC-5 failure branch: handleSave AND handleDelete SILENTLY SWALLOW — they `await api.post/put`
//    (resp. delete) WITHOUT inspecting res.error; only a THROWN error is caught. So a
//    `{ data, error: "..." }` response still closes the modal + refetches. Pinned below.
//  - delete confirm = modal; delete button = text-red-600 / bg-red-600. New=newAccount, Edit=editAccount.
//  - search filters the loaded accounts CLIENT-side (no server query param).

vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

const push = vi.fn();
const replace = vi.fn();
// STABLE router object (A78) — a fresh object per render churns useEffect([router]) deps and
// re-fires the data fetch on every keystroke (infinite-refetch trap). Define it ONCE.
const routerObj = { push, replace, refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => routerObj,
  usePathname: () => "/finance/accounts",
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href?: string;
  }) => <a href={typeof href === "string" ? href : "#"}>{children}</a>,
}));

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPut = vi.fn();
const apiDelete = vi.fn();
const apiUpload = vi.fn();
const authState = {
  isAuthenticated: true,
  isLoading: false,
  canReadFinance: true,
  canWriteFinance: true,
  isAdmin: true,
  isVorstand: true,
  isKassier: true,
  isAuditor: false,
  user: { name: "Kassier", email: "kassier@example.org" },
  accessToken: "tok",
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => ({
    get: apiGet,
    post: apiPost,
    put: apiPut,
    delete: apiDelete,
    upload: apiUpload,
  }),
}));

import Page from "./page";

const accounts = [
  {
    id: "a1",
    name: "Main Bank",
    number: "1020",
    type: "Bank",
    description: "Primary account",
    isActive: true,
    sortOrder: 0,
  },
  {
    id: "a2",
    name: "Petty Cash",
    number: "1000",
    type: "Cash",
    description: "Cash box",
    isActive: false,
    sortOrder: 1,
  },
];

function routeGet(url: string) {
  if (url === "/api/v1/finance/accounts")
    return Promise.resolve({
      data: { items: accounts },
      error: null,
      status: 200,
    });
  return Promise.resolve({ data: { items: [] }, error: null, status: 200 });
}

beforeEach(() => {
  apiGet.mockImplementation((url: string) => routeGet(url));
  apiPost.mockResolvedValue({ data: {}, error: null, status: 200 });
  apiPut.mockResolvedValue({ data: {}, error: null, status: 200 });
  apiDelete.mockResolvedValue({ data: null, error: null, status: 200 });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  Object.assign(authState, {
    isAuthenticated: true,
    isLoading: false,
    canReadFinance: true,
    canWriteFinance: true,
    isAdmin: true,
    isVorstand: true,
    isKassier: true,
    isAuditor: false,
  });
});

describe("Accounts — happy path + endpoint (E26-S1)", () => {
  it("renders the accounts table from GET /api/v1/finance/accounts", async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Main Bank")).toBeInTheDocument();
    });
    expect(screen.getByText("Petty Cash")).toBeInTheDocument();
    expect(
      apiGet.mock.calls.some((c) => c[0] === "/api/v1/finance/accounts")
    ).toBe(true);
  });

  it("filters the table client-side by the search term", async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Main Bank")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText("searchAccounts"), {
      target: { value: "petty" },
    });
    expect(screen.queryByText("Main Bank")).not.toBeInTheDocument();
    expect(screen.getByText("Petty Cash")).toBeInTheDocument();
  });

  it("shows the noAccounts empty state when the list is empty", async () => {
    apiGet.mockImplementation(() =>
      Promise.resolve({ data: { items: [] }, error: null, status: 200 })
    );
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("noAccounts")).toBeInTheDocument();
    });
  });
});

describe("Accounts — read guard (AC-2, lean role-only, A56)", () => {
  it("redirects to / via router.replace and renders null when !canReadFinance", async () => {
    authState.canReadFinance = false;
    render(<Page />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/");
    });
    expect(screen.queryByText("accounts")).not.toBeInTheDocument();
    expect(
      apiGet.mock.calls.some((c) => c[0] === "/api/v1/finance/accounts")
    ).toBe(false);
  });
});

describe("Accounts — write guard (AC-3)", () => {
  it("renders New + Edit + Delete affordances when canWriteFinance", async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Main Bank")).toBeInTheDocument();
    });
    expect(screen.getByText("newAccount")).toBeInTheDocument();
    expect(screen.getAllByText("editAccount").length).toBeGreaterThan(0);
    expect(screen.getAllByText("delete").length).toBeGreaterThan(0);
  });

  it("hides New + Edit + Delete when canReadFinance && !canWriteFinance", async () => {
    authState.canWriteFinance = false;
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Main Bank")).toBeInTheDocument();
    });
    expect(screen.queryByText("newAccount")).not.toBeInTheDocument();
    expect(screen.queryByText("editAccount")).not.toBeInTheDocument();
    expect(screen.queryByText("delete")).not.toBeInTheDocument();
  });
});

describe("Accounts — create/edit modal + POST/PUT (AC-4)", () => {
  it("POSTs the form to /api/v1/finance/accounts on create", async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("newAccount")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("newAccount"));
    // Required name + number gate the save button. The modal has name (textbox 0),
    // number (textbox 1) and a description textarea — use the textbox inputs by index.
    const modal = screen
      .getByText("newAccount", { selector: "h2" })
      .closest("div")!;
    const inputs = within(modal as HTMLElement).getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "Acme Acc" } });
    fireEvent.change(inputs[1], { target: { value: "1099" } });
    fireEvent.click(screen.getByText("save"));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/accounts",
        expect.objectContaining({ name: "Acme Acc", number: "1099" })
      );
    });
  });

  it("PUTs to /api/v1/finance/accounts/{id} on edit", async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Main Bank")).toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByText("editAccount")[0]);
    fireEvent.click(screen.getByText("save"));

    await waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith(
        "/api/v1/finance/accounts/a1",
        expect.objectContaining({ name: "Main Bank", number: "1020" })
      );
    });
  });

  it("A56: save SILENTLY SWALLOWS a res.error — modal closes + refetches anyway", async () => {
    apiPost.mockResolvedValue({ data: null, error: "boom", status: 400 });
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("newAccount")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("newAccount"));
    const modal = screen
      .getByText("newAccount", { selector: "h2" })
      .closest("div")!;
    const inputs = within(modal as HTMLElement).getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "X" } });
    fireEvent.change(inputs[1], { target: { value: "Y" } });
    fireEvent.click(screen.getByText("save"));

    // Modal closes (no h2 newAccount) despite the error — error is not inspected.
    await waitFor(() => {
      expect(
        screen.queryByText("newAccount", { selector: "h2" })
      ).not.toBeInTheDocument();
    });
    expect(screen.queryByText("saveError")).not.toBeInTheDocument();
  });
});

describe("Accounts — delete (AC-5: red, modal-confirm, silent-swallow)", () => {
  it("delete is a modal confirm and DELETEs /api/v1/finance/accounts/{id}", async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Main Bank")).toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByText("delete")[0]);
    // Confirm modal copy.
    expect(screen.getByText("confirmDelete")).toBeInTheDocument();
    // The confirm button is the red one (bg-red-600).
    const confirmBtn = screen
      .getAllByText("delete")
      .find((n) => n.className.includes("bg-red-600"))!;
    expect(confirmBtn.className).toContain("bg-red-600");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalledWith("/api/v1/finance/accounts/a1");
    });
  });

  it("A56: delete SILENTLY SWALLOWS a res.error (no deleteError banner)", async () => {
    apiDelete.mockResolvedValue({ data: null, error: "boom", status: 400 });
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Main Bank")).toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByText("delete")[0]);
    const confirmBtn = screen
      .getAllByText("delete")
      .find((n) => n.className.includes("bg-red-600"))!;
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalled();
    });
    expect(screen.queryByText("deleteError")).not.toBeInTheDocument();
  });
});
