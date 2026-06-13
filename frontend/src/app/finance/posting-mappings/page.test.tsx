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

// E26-S1 (S2 ledger/accounting) — characterization net for finance/posting-mappings.
//
// A56 note: guard CONFIRMED lean role-only + DoubleEntry mode guard (GET /api/v1/finance/profile;
//   router.replace("/finance/settings") unless accountingMode === "DoubleEntry"; data waits on
//   modeChecked). `if (!canReadFinance) router.replace("/")` + render-time `return null`.
//
// A79 deltas:
//  - AC-5 failure branch: handleSave AND handleDelete SILENTLY SWALLOW — no res.error inspection;
//    only a THROWN error is caught. Pinned.
//  - lookups fetched in parallel: ledger-accounts, categories, accounts, tax-codes (each tolerant of
//    [] or { items }).
//  - A95: the target + tax-target ledger-account <select>s are filtered to isActive on render.
//  - On EDIT, the mappingType + source selects are hidden; PUT carries ONLY
//    { ledgerAccountId, taxLedgerAccountId }. New=newMapping, Edit=edit, Delete=delete.

vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

const push = vi.fn();
const replace = vi.fn();
// STABLE router object (A78) — a fresh object per render churns useEffect([router]) deps. Define ONCE.
const routerObj = { push, replace, refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => routerObj,
  usePathname: () => "/finance/posting-mappings",
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

const mappings = [
  {
    id: "m1",
    mappingType: "Category",
    sourceId: "c1",
    ledgerAccountId: "l1",
    ledgerAccountNumber: "6000",
    ledgerAccountName: "Expenses",
    taxLedgerAccountId: null,
    taxLedgerAccountNumber: null,
    taxLedgerAccountName: null,
  },
];
const ledgerAccounts = [
  { id: "l1", number: "6000", name: "Expenses", isActive: true },
  { id: "l2", number: "9999", name: "Archived", isActive: false },
];
const categories = [{ id: "c1", name: "Office", type: "Expense" }];

function routeGet(url: string, mode = "DoubleEntry") {
  if (url === "/api/v1/finance/profile")
    return Promise.resolve({
      data: { accountingMode: mode },
      error: null,
      status: 200,
    });
  if (url === "/api/v1/finance/posting-mappings")
    return Promise.resolve({
      data: { items: mappings },
      error: null,
      status: 200,
    });
  if (url === "/api/v1/finance/ledger-accounts")
    return Promise.resolve({
      data: { items: ledgerAccounts },
      error: null,
      status: 200,
    });
  if (url === "/api/v1/finance/categories")
    return Promise.resolve({
      data: { items: categories },
      error: null,
      status: 200,
    });
  if (url === "/api/v1/finance/accounts")
    return Promise.resolve({ data: { items: [] }, error: null, status: 200 });
  if (url === "/api/v1/finance/tax-codes")
    return Promise.resolve({ data: { items: [] }, error: null, status: 200 });
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

describe("PostingMappings — happy path + endpoints (E26-S1)", () => {
  it("checks DoubleEntry mode then renders the mappings + lookup GETs", async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Office")).toBeInTheDocument();
    });
    const urls = apiGet.mock.calls.map((c) => c[0]);
    expect(urls).toContain("/api/v1/finance/profile");
    expect(urls).toContain("/api/v1/finance/posting-mappings");
    expect(urls).toContain("/api/v1/finance/ledger-accounts");
    expect(urls).toContain("/api/v1/finance/categories");
    expect(urls).toContain("/api/v1/finance/accounts");
    expect(urls).toContain("/api/v1/finance/tax-codes");
  });

  it("shows noMappings empty state when the list is empty", async () => {
    apiGet.mockImplementation((url: string) => {
      if (url === "/api/v1/finance/posting-mappings")
        return Promise.resolve({
          data: { items: [] },
          error: null,
          status: 200,
        });
      return routeGet(url);
    });
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("noMappings")).toBeInTheDocument();
    });
  });
});

describe("PostingMappings — DoubleEntry mode guard (AC-2, A56)", () => {
  it("redirects to /finance/settings when not DoubleEntry (no list GET)", async () => {
    apiGet.mockImplementation((url: string) => routeGet(url, "SingleEntry"));
    render(<Page />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/finance/settings");
    });
    expect(
      apiGet.mock.calls.some((c) => c[0] === "/api/v1/finance/posting-mappings")
    ).toBe(false);
  });

  it("redirects to / when !canReadFinance (renders null)", async () => {
    authState.canReadFinance = false;
    render(<Page />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/");
    });
    expect(screen.queryByText("postingMappings")).not.toBeInTheDocument();
  });
});

describe("PostingMappings — write guard (AC-3)", () => {
  it("renders New + Edit + Delete when canWriteFinance", async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Office")).toBeInTheDocument();
    });
    expect(screen.getByText("newMapping")).toBeInTheDocument();
    expect(screen.getAllByText("edit").length).toBeGreaterThan(0);
    expect(screen.getAllByText("delete").length).toBeGreaterThan(0);
  });

  it("hides New + Edit + Delete when canReadFinance && !canWriteFinance", async () => {
    authState.canWriteFinance = false;
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Office")).toBeInTheDocument();
    });
    expect(screen.queryByText("newMapping")).not.toBeInTheDocument();
    expect(screen.queryByText("edit")).not.toBeInTheDocument();
    expect(screen.queryByText("delete")).not.toBeInTheDocument();
  });
});

describe("PostingMappings — edit PUT subset + delete (AC-4/AC-5)", () => {
  it("PUTs ONLY { ledgerAccountId, taxLedgerAccountId } on edit", async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Office")).toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByText("edit")[0]);
    // On edit, mappingType + source selects are hidden — submit preserves loaded values.
    fireEvent.click(screen.getByText("save"));
    await waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith(
        "/api/v1/finance/posting-mappings/m1",
        { ledgerAccountId: "l1", taxLedgerAccountId: null }
      );
    });
  });

  it("A56: save SILENTLY SWALLOWS a res.error (modal closes, no saveError)", async () => {
    apiPut.mockResolvedValue({ data: null, error: "boom", status: 400 });
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Office")).toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByText("edit")[0]);
    fireEvent.click(screen.getByText("save"));
    await waitFor(() => {
      expect(
        screen.queryByText("editMapping", { selector: "h2" })
      ).not.toBeInTheDocument();
    });
    expect(screen.queryByText("saveError")).not.toBeInTheDocument();
  });

  it("DELETEs via the red modal confirm and SILENTLY SWALLOWS errors", async () => {
    apiDelete.mockResolvedValue({ data: null, error: "boom", status: 400 });
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Office")).toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByText("delete")[0]);
    expect(screen.getByText("confirmDelete")).toBeInTheDocument();
    const confirmBtn = screen
      .getAllByText("delete")
      .find((n) => n.className.includes("bg-red-600"))!;
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalledWith(
        "/api/v1/finance/posting-mappings/m1"
      );
    });
    expect(screen.queryByText("deleteError")).not.toBeInTheDocument();
  });
});
