// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// E26-S1 (S2 ledger/accounting) — characterization net for the Finance DASHBOARD page.
// Read-only KPI overview. Pins the CANONICAL read guard (isAuthenticated + authLoading +
// canReadFinance; spinner while authLoading||loading; router.push("/"); return null when
// !isAuthenticated || !canReadFinance) AND the four dashboard GETs.
//
// A56 note: guard CONFIRMED canonical. No write affordances (read-only page).
// A79 deltas: transactions GET returns { items: [...] } (sliced to 10); openInvoices is an
// OpenInvoice[] reduced client-side into { count, totalAmount }. All transport via useApiClient.

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
  usePathname: () => "/finance",
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

const summary = { totalIncome: 1000, totalExpense: 400, balance: 600 };
const dashboard = {
  totalIncome: 1000,
  totalExpense: 400,
  balance: 600,
  invoicesTotalOutstanding: 250,
  invoicesOverdueCount: 2,
  invoicesOverdueAmount: 80,
  invoicesOpenCount: 5,
  paymentsTotalPending: 120,
  paymentsTotalPaid: 0,
  paymentsPendingCount: 3,
  expenseClaimsTotalPending: 40,
  expenseClaimsTotalReimbursed: 0,
  expenseClaimsPendingCount: 1,
  currentFiscalPeriod: "2026",
  currentPeriodStatus: "Open",
};
const openInvoices = [
  { id: "i1", total: 100 },
  { id: "i2", total: 150 },
];
const transactions = {
  items: [
    {
      id: "t1",
      date: "2026-01-01",
      description: "Membership fee",
      amount: 50,
      type: "Income",
      categoryName: "Dues",
      accountName: "Bank",
    },
  ],
};

function routeGet(url: string) {
  if (url === "/api/v1/finance/transactions/summary")
    return Promise.resolve({ data: summary, error: null, status: 200 });
  if (url === "/api/v1/finance/dashboard")
    return Promise.resolve({ data: dashboard, error: null, status: 200 });
  if (url === "/api/v1/finance/invoices/open")
    return Promise.resolve({ data: openInvoices, error: null, status: 200 });
  if (url === "/api/v1/finance/transactions")
    return Promise.resolve({ data: transactions, error: null, status: 200 });
  return Promise.resolve({ data: null, error: null, status: 200 });
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

describe("Finance dashboard — happy path + endpoints (E26-S1)", () => {
  it("renders the KPI cards and open-items section after the four GETs resolve", async () => {
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText("dashboard")).toBeInTheDocument();
    });
    // KPI labels.
    expect(screen.getByText("totalIncome")).toBeInTheDocument();
    expect(screen.getByText("balance")).toBeInTheDocument();
    expect(screen.getByText("openItemsSection")).toBeInTheDocument();
    expect(screen.getByText("recentTransactions")).toBeInTheDocument();
    // Recent transaction row content.
    expect(screen.getByText("Membership fee")).toBeInTheDocument();
  });

  it("fires the four dashboard GETs at the exact URLs", async () => {
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText("dashboard")).toBeInTheDocument();
    });
    const urls = apiGet.mock.calls.map((c) => c[0]);
    expect(urls).toContain("/api/v1/finance/transactions/summary");
    expect(urls).toContain("/api/v1/finance/dashboard");
    expect(urls).toContain("/api/v1/finance/invoices/open");
    expect(urls).toContain("/api/v1/finance/transactions");
  });

  it("renders the current fiscal period + status when present", async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("currentFiscalPeriod:")).toBeInTheDocument();
    });
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("shows the noData empty state when there are no recent transactions", async () => {
    apiGet.mockImplementation((url: string) => {
      if (url === "/api/v1/finance/transactions")
        return Promise.resolve({
          data: { items: [] },
          error: null,
          status: 200,
        });
      return routeGet(url);
    });
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("noData")).toBeInTheDocument();
    });
  });
});

describe("Finance dashboard — canonical read guard (AC-2, A56)", () => {
  it("redirects an unauthenticated user to / and renders null (no finance GETs)", async () => {
    authState.isAuthenticated = false;
    render(<Page />);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/");
    });
    expect(screen.queryByText("dashboard")).not.toBeInTheDocument();
    // Canonical guard does not fire the dashboard GETs when denied.
    expect(
      apiGet.mock.calls.some((c) => c[0] === "/api/v1/finance/dashboard")
    ).toBe(false);
  });

  it("redirects a non-canReadFinance user to / (push target is /, not /login)", async () => {
    authState.canReadFinance = false;
    render(<Page />);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/");
    });
    expect(screen.queryByText("dashboard")).not.toBeInTheDocument();
  });
});
