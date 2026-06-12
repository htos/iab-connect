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

// ============================================================================
// E26-S1 (REQ-044 E6-S3) S4 char-net EXTENSION — pin AS-IS at HEAD (DEC-1=A).
// A79 deltas: useApiClient-direct (BUILD); lib/api/budgets.ts is types+consts only.
// Server-computed rows: the page renders report.rows budget/actual/variance/variancePercent
// verbatim — it does NOT compute them; it only picks the variance<0 → text-red-600 colour.
// CSV export = raw api.get<Blob>(/exports/budget-vs-actual?...) → object-URL → anchor.download
// = "budget-vs-actual.csv" → click → revokeObjectURL (highest-risk; pin the blob URL + filename).
// ============================================================================

describe("BudgetVsActualPage — server-computed rows + variance colour (AC-5)", () => {
  async function generate(report: unknown) {
    apiGet.mockImplementation((url: string) => {
      if (url.includes("/activity-areas")) {
        return Promise.resolve({
          data: {
            items: [{ id: "a1", name: "Events", code: "EVT", isActive: true }],
          },
        });
      }
      if (url.includes("/fiscal-periods")) {
        return Promise.resolve({ data: { items: [{ id: "p1", name: "2026-01" }] } });
      }
      if (url.includes("/budget-vs-actual")) {
        return Promise.resolve({ data: report });
      }
      return Promise.resolve({ data: {} });
    });
    render(<BudgetVsActualPage />);
    await waitFor(() => {
      expect(screen.getAllByText("2026-01").length).toBeGreaterThanOrEqual(1);
    });
    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "p1" },
    });
    fireEvent.click(screen.getByText("generate"));
  }

  it("renders the SERVER-supplied budget/actual/variance bytes verbatim", async () => {
    await generate(REPORT);
    await waitFor(() => {
      expect(screen.getByText("50.00%")).toBeInTheDocument();
    });
    // The server row budget=1000, actual=500, variance=500 — formatCurrency renders each.
    expect(screen.getByText(/1.?000\.00/)).toBeInTheDocument();
    // variance %  comes straight from variancePercent.toFixed(2) — page does NOT recompute.
  });

  it("colours a negative variance row red (variance<0 → text-red-600)", async () => {
    const negative = {
      ...REPORT,
      rows: [
        {
          ...REPORT.rows[0],
          budget: 100,
          actual: 400,
          variance: -300,
          variancePercent: -300,
        },
      ],
    };
    await generate(negative);
    await waitFor(() => {
      expect(screen.getByText("-300.00%")).toBeInTheDocument();
    });
    const pctCell = screen.getByText("-300.00%");
    expect(pctCell.className).toContain("text-red-600");
  });
});

describe("BudgetVsActualPage — area filter (AC-4 query params)", () => {
  it("appends activityAreaId to the budget-vs-actual GET when an area is selected", async () => {
    wireApi();
    render(<BudgetVsActualPage />);
    await waitFor(() => {
      expect(screen.getAllByText("2026-01").length).toBeGreaterThanOrEqual(1);
    });
    const [periodSelect, areaSelect] = screen.getAllByRole("combobox");
    fireEvent.change(periodSelect, { target: { value: "p1" } });
    fireEvent.change(areaSelect, { target: { value: "a1" } });
    fireEvent.click(screen.getByText("generate"));

    await waitFor(() => {
      expect(
        apiGet.mock.calls.some(
          (c) =>
            c[0] ===
            "/api/v1/finance/budgets/budget-vs-actual?fiscalPeriodId=p1&activityAreaId=a1"
        )
      ).toBe(true);
    });
  });
});

describe("BudgetVsActualPage — noData empty state (AC-4)", () => {
  it("shows noData when the report comes back with zero rows", async () => {
    apiGet.mockImplementation((url: string) => {
      if (url.includes("/activity-areas")) {
        return Promise.resolve({
          data: { items: [{ id: "a1", name: "Events", code: "EVT", isActive: true }] },
        });
      }
      if (url.includes("/fiscal-periods")) {
        return Promise.resolve({ data: { items: [{ id: "p1", name: "2026-01" }] } });
      }
      if (url.includes("/budget-vs-actual")) {
        return Promise.resolve({ data: { ...REPORT, rows: [] } });
      }
      return Promise.resolve({ data: {} });
    });
    render(<BudgetVsActualPage />);
    await waitFor(() => {
      expect(screen.getAllByText("2026-01").length).toBeGreaterThanOrEqual(1);
    });
    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "p1" },
    });
    fireEvent.click(screen.getByText("generate"));

    await waitFor(() => {
      expect(screen.getByText("noData")).toBeInTheDocument();
    });
  });
});

describe("BudgetVsActualPage — CSV export blob path (AC-6 highest-risk)", () => {
  it("GETs /exports/budget-vs-actual, builds an object-URL, downloads budget-vs-actual.csv, then revokes", async () => {
    const createObjectURL = vi.fn(() => "blob:mock-csv");
    const revokeObjectURL = vi.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    // Spy on anchor.click without stubbing createElement (real anchor; jsdom click is a no-op),
    // and capture the download filename the page assigns.
    let downloadName: string | null = null;
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloadName = this.download;
      });

    const blob = new Blob(["a,b,c"], { type: "text/csv" });
    apiGet.mockImplementation((url: string) => {
      if (url.includes("/activity-areas")) {
        return Promise.resolve({
          data: { items: [{ id: "a1", name: "Events", code: "EVT", isActive: true }] },
        });
      }
      if (url.includes("/fiscal-periods")) {
        return Promise.resolve({ data: { items: [{ id: "p1", name: "2026-01" }] } });
      }
      if (url.startsWith("/api/v1/finance/exports/budget-vs-actual")) {
        return Promise.resolve({ data: blob, error: null });
      }
      if (url.includes("/budget-vs-actual")) {
        return Promise.resolve({ data: REPORT });
      }
      return Promise.resolve({ data: {} });
    });

    render(<BudgetVsActualPage />);
    await waitFor(() => {
      expect(screen.getAllByText("2026-01").length).toBeGreaterThanOrEqual(1);
    });
    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "p1" },
    });
    // Generate first — export is disabled until a report is present.
    fireEvent.click(screen.getByText("generate"));
    await waitFor(() => {
      expect(screen.getByText("50.00%")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("exportCsv"));

    await waitFor(() => {
      expect(
        apiGet.mock.calls.some(
          (c) =>
            c[0] ===
            "/api/v1/finance/exports/budget-vs-actual?fiscalPeriodId=p1"
        )
      ).toBe(true);
    });
    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledWith(blob);
    });
    expect(clickSpy).toHaveBeenCalled();
    // Hardcoded client filename.
    expect(downloadName).toBe("budget-vs-actual.csv");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-csv");

    clickSpy.mockRestore();
  });
});
