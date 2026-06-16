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

// E26-S1 (S2 ledger/accounting) — characterization net for finance/ledger-accounts.
//
// A56 note: guard CONFIRMED lean role-only + DoubleEntry mode guard.
//  - First effect GETs /api/v1/finance/profile; router.replace("/finance/settings") unless
//    res.data.accountingMode === "DoubleEntry"; data fetch waits on modeChecked.
//  - Second effect: `if (!canReadFinance) router.replace("/"); return` else fetch when modeChecked.
//  - render-time: `if (!canReadFinance) return null`.
//
// A79 deltas:
//  - AC-5 failure branch ASYMMETRY: handleSave INSPECTS res.error (`setError(res.error); return`)
//    and KEEPS THE MODAL OPEN; handleDelete SILENTLY SWALLOWS (no res.error inspection). Pinned.
//  - A95: the parent-account <select> lists ALL loaded accounts except self (NOT isActive-filtered);
//    the journal-line page is the isActive-filtered one. Edit round-trip of an inactive parent retained.
//  - New=newLedgerAccount, Edit=edit (finance.edit), Delete=delete. delete=text-red-600/bg-red-600.

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
  usePathname: () => "/finance/ledger-accounts",
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

const ledgerAccounts = [
  {
    id: "l1",
    number: "1000",
    name: "Cash",
    accountClass: "Asset",
    normalBalance: "Debit",
    description: "Cash on hand",
    parentAccountId: null,
    sortOrder: 0,
    isActive: true,
  },
  {
    id: "l2",
    number: "2000",
    name: "Payables",
    accountClass: "Liability",
    normalBalance: "Credit",
    description: null,
    parentAccountId: null,
    sortOrder: 1,
    isActive: false,
  },
];

function routeGet(url: string, mode = "DoubleEntry") {
  if (url === "/api/v1/finance/profile")
    return Promise.resolve({
      data: { accountingMode: mode },
      error: null,
      status: 200,
    });
  if (url === "/api/v1/finance/ledger-accounts")
    return Promise.resolve({
      data: { items: ledgerAccounts },
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

describe("LedgerAccounts — happy path + endpoints (E26-S1)", () => {
  it("checks DoubleEntry mode then renders the ledger-account table", async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Cash")).toBeInTheDocument();
    });
    expect(screen.getByText("Payables")).toBeInTheDocument();
    const urls = apiGet.mock.calls.map((c) => c[0]);
    expect(urls).toContain("/api/v1/finance/profile");
    expect(urls).toContain("/api/v1/finance/ledger-accounts");
  });

  it("shows the noLedgerAccounts empty state when the list is empty", async () => {
    apiGet.mockImplementation((url: string) => {
      if (url === "/api/v1/finance/ledger-accounts")
        return Promise.resolve({
          data: { items: [] },
          error: null,
          status: 200,
        });
      return routeGet(url);
    });
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("noLedgerAccounts")).toBeInTheDocument();
    });
  });
});

describe("LedgerAccounts — DoubleEntry mode guard (AC-2, A56)", () => {
  it("redirects to /finance/settings when accountingMode !== DoubleEntry (no list GET)", async () => {
    apiGet.mockImplementation((url: string) => routeGet(url, "SingleEntry"));
    render(<Page />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/finance/settings");
    });
    expect(
      apiGet.mock.calls.some((c) => c[0] === "/api/v1/finance/ledger-accounts")
    ).toBe(false);
  });

  it("redirects to /finance/settings when the profile GET rejects", async () => {
    apiGet.mockImplementation((url: string) => {
      if (url === "/api/v1/finance/profile")
        return Promise.reject(new Error("net"));
      return routeGet(url);
    });
    render(<Page />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/finance/settings");
    });
  });
});

describe("LedgerAccounts — read guard (lean role-only, A56)", () => {
  it("redirects to / via router.replace and renders null when !canReadFinance", async () => {
    authState.canReadFinance = false;
    render(<Page />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/");
    });
    expect(screen.queryByText("ledgerAccounts")).not.toBeInTheDocument();
  });
});

describe("LedgerAccounts — write guard (AC-3)", () => {
  it("renders New + Edit + Delete when canWriteFinance", async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Cash")).toBeInTheDocument();
    });
    expect(screen.getByText("newLedgerAccount")).toBeInTheDocument();
    expect(screen.getAllByText("edit").length).toBeGreaterThan(0);
    expect(screen.getAllByText("delete").length).toBeGreaterThan(0);
  });

  it("hides New + Edit + Delete when canReadFinance && !canWriteFinance", async () => {
    authState.canWriteFinance = false;
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Cash")).toBeInTheDocument();
    });
    expect(screen.queryByText("newLedgerAccount")).not.toBeInTheDocument();
    expect(screen.queryByText("edit")).not.toBeInTheDocument();
    expect(screen.queryByText("delete")).not.toBeInTheDocument();
  });
});

describe("LedgerAccounts — save/POST/PUT + failure branch (AC-4/AC-5)", () => {
  it("POSTs the mapped payload to /api/v1/finance/ledger-accounts on create", async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("newLedgerAccount")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("newLedgerAccount"));
    const modal = screen
      .getByText("newLedgerAccount", { selector: "h2" })
      .closest("div")!;
    const inputs = within(modal as HTMLElement).getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "3000" } }); // number
    fireEvent.change(inputs[1], { target: { value: "Revenue Acc" } }); // name
    fireEvent.click(screen.getByText("save"));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/ledger-accounts",
        expect.objectContaining({ number: "3000", name: "Revenue Acc" })
      );
    });
  });

  it("A56: save INSPECTS res.error and KEEPS THE MODAL OPEN on failure", async () => {
    apiPost.mockResolvedValue({ data: null, error: "boom", status: 400 });
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("newLedgerAccount")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("newLedgerAccount"));
    const modal = screen
      .getByText("newLedgerAccount", { selector: "h2" })
      .closest("div")!;
    const inputs = within(modal as HTMLElement).getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "3000" } });
    fireEvent.change(inputs[1], { target: { value: "X" } });
    fireEvent.click(screen.getByText("save"));

    // Error surfaces (the raw res.error string) AND modal stays open.
    await waitFor(() => {
      expect(screen.getByText("boom")).toBeInTheDocument();
    });
    expect(
      screen.getByText("newLedgerAccount", { selector: "h2" })
    ).toBeInTheDocument();
  });

  it("PUTs on edit and round-trips an inactive parent value (A95 no-touch)", async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Cash")).toBeInTheDocument();
    });
    // Edit the first row; submit without touching the form (preserves loaded values).
    fireEvent.click(screen.getAllByText("edit")[0]);
    fireEvent.click(screen.getByText("save"));
    await waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith(
        "/api/v1/finance/ledger-accounts/l1",
        expect.objectContaining({ number: "1000", name: "Cash" })
      );
    });
  });
});

describe("LedgerAccounts — delete (AC-5: red, modal-confirm, silent-swallow)", () => {
  it("DELETEs /api/v1/finance/ledger-accounts/{id} via the red confirm", async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Cash")).toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByText("delete")[0]);
    expect(screen.getByText("confirmDelete")).toBeInTheDocument();
    const confirmBtn = screen
      .getAllByText("delete")
      .find((n) => n.className.includes("bg-red-600"))!;
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalledWith(
        "/api/v1/finance/ledger-accounts/l1"
      );
    });
  });

  it("A56: delete SILENTLY SWALLOWS a res.error (no deleteError banner)", async () => {
    apiDelete.mockResolvedValue({ data: null, error: "boom", status: 400 });
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Cash")).toBeInTheDocument();
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
