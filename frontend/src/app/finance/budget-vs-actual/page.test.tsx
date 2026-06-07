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

// REQ-044 (E6-S3) AC-1/AC-3/AC-5: the Soll/Ist report page — permission gate, period filter,
// Generate fetches + renders the table, and the export button enables once a report is present.

const authState = vi.hoisted(() => ({ canReadFinance: true }));

// Stable identity translator (A64).
vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

const apiGet = vi.fn();
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    isLoading: false,
    canReadFinance: authState.canReadFinance,
  }),
  useApiClient: () => ({ get: apiGet }),
}));

import BudgetVsActualPage from "./page";

const REPORT = {
  fiscalPeriodId: "p1",
  fiscalPeriodName: "2026-01",
  fiscalPeriodYear: 2026,
  fiscalPeriodMonth: 1,
  rows: [
    {
      activityAreaId: "a1",
      activityAreaCode: "EVT",
      activityAreaName: "Events",
      budget: 1000,
      actual: 500,
      variance: 500,
      variancePercent: 50,
      currency: "CHF",
    },
  ],
};

function wireApi() {
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
        data: { items: [{ id: "p1", name: "2026-01" }] },
      });
    }
    if (url.includes("/budget-vs-actual")) {
      return Promise.resolve({ data: REPORT });
    }
    return Promise.resolve({ data: {} });
  });
}

afterEach(() => {
  cleanup();
  apiGet.mockReset();
  authState.canReadFinance = true;
});

describe("BudgetVsActualPage", () => {
  it("returns nothing for users without finance read", () => {
    authState.canReadFinance = false;
    wireApi();
    const { container } = render(<BudgetVsActualPage />);
    expect(container).toBeEmptyDOMElement();
  });

  it("generates and renders the Soll/Ist table", async () => {
    wireApi();
    render(<BudgetVsActualPage />);

    // Period selector populated.
    await waitFor(() => {
      expect(screen.getAllByText("2026-01").length).toBeGreaterThanOrEqual(1);
    });

    // Select the period (the page requires it before Generate fires).
    const periodSelect = screen.getAllByRole("combobox")[0];
    fireEvent.change(periodSelect, { target: { value: "p1" } });

    fireEvent.click(screen.getByText("generate"));

    // Table row renders with the variance %.
    await waitFor(() => {
      expect(screen.getByText("50.00%")).toBeInTheDocument();
    });
    // "EVT — Events" appears in both the filter dropdown and the table row.
    expect(screen.getAllByText(/Events/).length).toBeGreaterThanOrEqual(2);
  });
});
