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

// E26-S1 (S2 ledger/accounting) — characterization net for finance/accounting-reports (read-only).
//
// A56 note: guard CONFIRMED lean role-only + DoubleEntry mode guard, PLUS render-time
//   `if (!canReadFinance || !modeChecked) return null` (BLANK, not a spinner). Two effects:
//   (1) profile GET → router.replace("/finance/settings") unless DoubleEntry, set modeChecked;
//   (2) `if (!canReadFinance) router.replace("/")`.
//
// A79 deltas:
//  - Read-only page: no write affordances. Generate is a read action (fires the report GET).
//  - Report GETs carry query params built from URLSearchParams: trial-balance?from=&to= /
//    balance-sheet?asOfDate= / profit-and-loss?from=&to=. asOfDate defaults to today (non-empty).
//  - No report data is fetched on mount — only on Generate click (no auto-load).

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
  usePathname: () => "/finance/accounting-reports",
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

const trialBalance = {
  totalDebit: 100,
  totalCredit: 100,
  lines: [
    {
      ledgerAccountId: "l1",
      accountNumber: "1000",
      accountName: "Cash",
      accountClass: "Asset",
      totalDebit: 100,
      totalCredit: 0,
      balance: 100,
    },
  ],
};

function routeGet(url: string, mode = "DoubleEntry") {
  if (url === "/api/v1/finance/profile")
    return Promise.resolve({
      data: { accountingMode: mode },
      error: null,
      status: 200,
    });
  if (url.startsWith("/api/v1/finance/accounting-reports/trial-balance"))
    return Promise.resolve({ data: trialBalance, error: null, status: 200 });
  if (url.startsWith("/api/v1/finance/accounting-reports/balance-sheet"))
    return Promise.resolve({
      data: {
        assets: [],
        liabilities: [],
        equity: [],
        totalAssets: 0,
        totalLiabilities: 0,
        totalEquity: 0,
      },
      error: null,
      status: 200,
    });
  if (url.startsWith("/api/v1/finance/accounting-reports/profit-and-loss"))
    return Promise.resolve({
      data: {
        revenue: [],
        expenses: [],
        totalRevenue: 0,
        totalExpenses: 0,
        netResult: 0,
      },
      error: null,
      status: 200,
    });
  return Promise.resolve({ data: null, error: null, status: 200 });
}

beforeEach(() => {
  apiGet.mockImplementation((url: string) => routeGet(url));
  apiPost.mockResolvedValue({ data: {}, error: null, status: 200 });
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

describe("AccountingReports — happy path + Generate endpoints (E26-S1)", () => {
  it("renders the report tabs after the mode check", async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("reports")).toBeInTheDocument();
    });
    expect(screen.getAllByText("trialBalance").length).toBeGreaterThan(0);
    expect(screen.getAllByText("balanceSheet").length).toBeGreaterThan(0);
    expect(screen.getAllByText("profitAndLoss").length).toBeGreaterThan(0);
  });

  it("Generate on the Trial Balance tab GETs trial-balance?from=&to=", async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("generate")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("generate"));
    await waitFor(() => {
      expect(
        apiGet.mock.calls.some((c) =>
          c[0].startsWith("/api/v1/finance/accounting-reports/trial-balance?")
        )
      ).toBe(true);
    });
    // Renders the loaded trial-balance row.
    await waitFor(() => {
      expect(screen.getByText("Cash")).toBeInTheDocument();
    });
  });

  it("Balance Sheet Generate GETs balance-sheet?asOfDate=<today>", async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("generate")).toBeInTheDocument();
    });
    // Switch to the balance-sheet tab (tab button label === ta("balanceSheet")).
    const tabBtn = screen
      .getAllByText("balanceSheet")
      .find((n) => n.tagName === "BUTTON")!;
    fireEvent.click(tabBtn);
    fireEvent.click(screen.getByText("generate"));
    await waitFor(() => {
      expect(
        apiGet.mock.calls.some((c) =>
          c[0].startsWith(
            "/api/v1/finance/accounting-reports/balance-sheet?asOfDate="
          )
        )
      ).toBe(true);
    });
  });

  it("does NOT fetch any report on mount (Generate-driven only)", async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("reports")).toBeInTheDocument();
    });
    expect(
      apiGet.mock.calls.some((c) => c[0].includes("/accounting-reports/"))
    ).toBe(false);
  });
});

describe("AccountingReports — DoubleEntry mode guard + blank render (AC-2, A56)", () => {
  it("returns null (blank, no tabs) and redirects to /finance/settings when not DoubleEntry", async () => {
    apiGet.mockImplementation((url: string) => routeGet(url, "SingleEntry"));
    render(<Page />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/finance/settings");
    });
    expect(screen.queryByText("reports")).not.toBeInTheDocument();
  });

  it("redirects to / when !canReadFinance (and renders null)", async () => {
    authState.canReadFinance = false;
    render(<Page />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/");
    });
    expect(screen.queryByText("reports")).not.toBeInTheDocument();
  });
});
