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

// E26-S1 (S2 ledger/accounting) — characterization net for finance/fiscal-periods.
//
// A56 note: guard CONFIRMED INLINE error page (no redirect, no router):
//   - `if (authLoading) return <spinner main>`
//   - `if (!canReadFinance) return <inline error main>{tc("error")}</inline>`  (common.error)
//   - NO router import, NO redirect. (This page does NOT call useRouter at all.)
//
// A79 deltas:
//  - list GET carries ?year=<selectedYear> (server-filtered); search is CLIENT-side.
//  - AC-5 actions: close=yellow (border-yellow-300/bg-yellow-50/text-yellow-800),
//    lock=gray, reopen=blue, unlock=red; ALL are MODAL-confirm.
//  - Unlock is ADMIN-ONLY (isAdmin, NOT canWriteFinance) — Locked rows only.
//  - Failure branch (A56): close/lock/reopen/unlock set the error BANNER on res.error but STILL
//    CLOSE THE MODAL in `finally` (modalType=null). Pinned.
//  - generate is a POST (not modal): /fiscal-periods/generate { year }; 409 + "finance profile" →
//    noProfileError amber panel; success sets a 4s auto-dismiss banner.

vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

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

const openPeriod = {
  id: "p1",
  name: "Q1 2026",
  startDate: "2026-01-01",
  endDate: "2026-03-31",
  status: "Open",
  totalIncome: null,
  totalExpense: null,
  closingBalance: null,
};
const closedPeriod = {
  id: "p2",
  name: "Q2 2026",
  startDate: "2026-04-01",
  endDate: "2026-06-30",
  status: "Closed",
  totalIncome: 1000,
  totalExpense: 400,
  closingBalance: 600,
};
const lockedPeriod = {
  id: "p3",
  name: "Q3 2026",
  startDate: "2026-07-01",
  endDate: "2026-09-30",
  status: "Locked",
  totalIncome: 800,
  totalExpense: 800,
  closingBalance: 0,
};

function routeGet(items: unknown[]) {
  return (url: string) => {
    if (url.startsWith("/api/v1/finance/fiscal-periods"))
      return Promise.resolve({ data: { items }, error: null, status: 200 });
    return Promise.resolve({ data: { items: [] }, error: null, status: 200 });
  };
}

beforeEach(() => {
  apiGet.mockImplementation(routeGet([openPeriod, closedPeriod, lockedPeriod]));
  apiPost.mockResolvedValue({ data: [], error: null, status: 200 });
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

describe("FiscalPeriods — happy path + ?year endpoint (E26-S1)", () => {
  it("renders the periods table and GETs fiscal-periods?year=<year>", async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Q1 2026")).toBeInTheDocument();
    });
    expect(screen.getByText("Q2 2026")).toBeInTheDocument();
    expect(
      apiGet.mock.calls.some((c) =>
        /\/api\/v1\/finance\/fiscal-periods\?year=\d+/.test(c[0])
      )
    ).toBe(true);
  });

  it("shows the empty state (noPeriodsTitle) when there are no periods", async () => {
    apiGet.mockImplementation(routeGet([]));
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("noPeriodsTitle")).toBeInTheDocument();
    });
  });
});

describe("FiscalPeriods — inline error guard (AC-2, A56: no redirect)", () => {
  it("renders the spinner while authLoading and does NOT fetch", async () => {
    authState.isLoading = true;
    render(<Page />);
    // No table, no fetch.
    expect(screen.queryByText("Q1 2026")).not.toBeInTheDocument();
    expect(apiGet.mock.calls.some((c) => c[0].includes("fiscal-periods"))).toBe(
      false
    );
  });

  it("renders the inline common.error main (NO redirect) when !canReadFinance", async () => {
    authState.canReadFinance = false;
    render(<Page />);
    // Inline error text; page never fetches.
    await waitFor(() => {
      expect(screen.getByText("error")).toBeInTheDocument();
    });
    expect(screen.queryByText("Q1 2026")).not.toBeInTheDocument();
    expect(apiGet.mock.calls.some((c) => c[0].includes("fiscal-periods"))).toBe(
      false
    );
  });
});

describe("FiscalPeriods — write/action guards (AC-3)", () => {
  it("Open row shows Close (yellow); Closed row shows Lock + Reopen; Locked row shows Unlock", async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Q1 2026")).toBeInTheDocument();
    });
    const closeBtn = screen.getByText("close");
    expect(closeBtn.className).toContain("yellow");
    expect(screen.getByText("lock")).toBeInTheDocument();
    expect(screen.getByText("reopen")).toBeInTheDocument();
    // Unlock present because isAdmin (Locked row).
    expect(screen.getByText("unlock")).toBeInTheDocument();
  });

  it("hides Close/Lock/Reopen when !canWriteFinance but KEEPS Unlock when isAdmin", async () => {
    authState.canWriteFinance = false;
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Q1 2026")).toBeInTheDocument();
    });
    expect(screen.queryByText("close")).not.toBeInTheDocument();
    expect(screen.queryByText("lock")).not.toBeInTheDocument();
    expect(screen.queryByText("reopen")).not.toBeInTheDocument();
    // Unlock is isAdmin-gated, NOT canWriteFinance — still present.
    expect(screen.getByText("unlock")).toBeInTheDocument();
    // Generate is canWriteFinance-gated — hidden.
    expect(screen.queryByText("generate")).not.toBeInTheDocument();
  });

  it("hides Unlock when !isAdmin even if canWriteFinance", async () => {
    authState.isAdmin = false;
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Q1 2026")).toBeInTheDocument();
    });
    expect(screen.queryByText("unlock")).not.toBeInTheDocument();
  });
});

describe("FiscalPeriods — close action (AC-5: yellow, modal, banner+modal-closes-on-error)", () => {
  it("POSTs /fiscal-periods/{id}/close { notes } via the modal confirm", async () => {
    apiPost.mockResolvedValue({ data: {}, error: null, status: 200 });
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Q1 2026")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("close"));
    expect(screen.getByText("closeConfirmTitle")).toBeInTheDocument();
    fireEvent.click(screen.getByText("confirm"));
    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/fiscal-periods/p1/close",
        { notes: null }
      );
    });
  });

  it("A56: close failure shows the error BANNER but STILL CLOSES the modal (finally)", async () => {
    apiPost.mockResolvedValue({ data: null, error: "boom", status: 400 });
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Q1 2026")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("close"));
    fireEvent.click(screen.getByText("confirm"));
    await waitFor(() => {
      expect(screen.getByText("boom")).toBeInTheDocument();
    });
    // Modal closed despite the error.
    expect(screen.queryByText("closeConfirmTitle")).not.toBeInTheDocument();
  });
});

describe("FiscalPeriods — generate (POST, 409 no-profile panel) (AC-4/A99)", () => {
  it("POSTs /fiscal-periods/generate { year } on the header button", async () => {
    apiPost.mockResolvedValue({ data: [], error: null, status: 200 });
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Q1 2026")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("generate"));
    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/fiscal-periods/generate",
        expect.objectContaining({ year: expect.any(Number) })
      );
    });
  });

  it("shows the amber no-finance-profile panel on a 409 'finance profile' error", async () => {
    apiPost.mockResolvedValue({
      data: null,
      error: "No finance profile configured",
      status: 409,
    });
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Q1 2026")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("generate"));
    await waitFor(() => {
      expect(screen.getByText("noFinanceProfile")).toBeInTheDocument();
    });
    expect(screen.getByText("goToSettings →")).toBeInTheDocument();
  });
});
