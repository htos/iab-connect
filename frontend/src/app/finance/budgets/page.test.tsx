// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// REQ-044 (E6-S1) AC-1/AC-2: cover the budgets management surface — list rendering from the API,
// permission gating (write-only controls hidden for read-only users), and the create button.

// Mutable auth flags so each test can flip read/write permissions.
const authState = vi.hoisted(() => ({
  canReadFinance: true,
  canWriteFinance: true,
}));

// next-intl: identity translator. MUST be a STABLE reference (A64) — the page keeps `t` in its
// data-load useEffect deps, so a fresh function per render would re-fire the effect forever.
vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

const apiGet = vi.fn();
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    isLoading: false,
    canReadFinance: authState.canReadFinance,
    canWriteFinance: authState.canWriteFinance,
  }),
  useApiClient: () => ({
    get: apiGet,
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  }),
}));

import BudgetsPage from "./page";

const BUDGET_ROW = {
  id: "b1",
  activityAreaId: "a1",
  activityAreaName: "Events",
  activityAreaCode: "EVT",
  fiscalPeriodId: "p1",
  fiscalPeriodName: "2026-01",
  fiscalPeriodYear: 2026,
  fiscalPeriodMonth: 1,
  amount: 1500,
  currency: "CHF",
  notes: "Diwali",
  createdAt: "2026-06-07T00:00:00Z",
  createdBy: "kassier",
  updatedAt: null,
  updatedBy: null,
};

function wireApi(budgets: unknown[]) {
  apiGet.mockImplementation((url: string) => {
    if (url.includes("/activity-areas")) {
      return Promise.resolve({
        data: {
          items: [{ id: "a1", name: "Events", code: "EVT", isActive: true }],
        },
      });
    }
    if (url.includes("/fiscal-periods")) {
      return Promise.resolve({
        data: { items: [{ id: "p1", name: "2026-01", year: 2026, month: 1 }] },
      });
    }
    // budgets
    return Promise.resolve({ data: budgets });
  });
}

afterEach(() => {
  cleanup();
  apiGet.mockReset();
  authState.canReadFinance = true;
  authState.canWriteFinance = true;
});

describe("BudgetsPage", () => {
  it("renders budget rows from the API", async () => {
    wireApi([BUDGET_ROW]);
    render(<BudgetsPage />);

    // formatCurrency(1500, "CHF") renders only in the table row (unique), not in any dropdown.
    await waitFor(() => {
      expect(screen.getByText(/1.?500/)).toBeInTheDocument();
    });
    // "2026-01" + "EVT — Events" appear in both the filter dropdown and the row → at least 2 each.
    expect(screen.getAllByText("2026-01").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/Events/).length).toBeGreaterThanOrEqual(2);
  });

  it("shows the add button for users who can write finance", async () => {
    authState.canWriteFinance = true;
    wireApi([]);
    render(<BudgetsPage />);

    await waitFor(() => {
      expect(screen.getByText("addBudget")).toBeInTheDocument();
    });
  });

  it("hides the add button for read-only users", async () => {
    authState.canWriteFinance = false;
    wireApi([]);
    render(<BudgetsPage />);

    await waitFor(() => {
      expect(screen.getByText("noBudgets")).toBeInTheDocument();
    });
    expect(screen.queryByText("addBudget")).not.toBeInTheDocument();
  });
});
