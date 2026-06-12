// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// REQ-044 (E6-S1) AC-1/AC-2: cover the budgets management surface — list rendering from the API,
// permission gating (write-only controls hidden for read-only users), and the create button.

// Mutable auth flags so each test can flip read/write permissions.
// E26-S1 (S4 char-net): added mutable `isLoading` so the authLoading-skeleton test can flip it.
const authState = vi.hoisted(() => ({
  isLoading: false,
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
// E26-S1: STABLE write-spies (A78) — defined once, reset in afterEach so each suite gets a clean bag.
const apiPost = vi.fn();
const apiPut = vi.fn();
const apiDelete = vi.fn();
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    isLoading: authState.isLoading,
    canReadFinance: authState.canReadFinance,
    canWriteFinance: authState.canWriteFinance,
  }),
  useApiClient: () => ({
    get: apiGet,
    post: apiPost,
    put: apiPut,
    delete: apiDelete,
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
  apiPost.mockReset();
  apiPut.mockReset();
  apiDelete.mockReset();
  authState.isLoading = false;
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

// ============================================================================
// E26-S1 (REQ-044) S4 char-net EXTENSION — pin AS-IS at HEAD (DEC-1=A: extend, don't rewrite).
// A79 deltas: pages call useApiClient direct (BUILD-on-useApiClient); lib/api/budgets.ts is
// types+consts ONLY. A95: area/period <select>s are disabled-on-edit (raw stored value retained);
// currency is a closed CHF/EUR set. A96: NO submitted field is trimmed. AC-5: delete is an inline
// two-step confirm (NOT a modal); destructive confirm is bg-red-600.
// ============================================================================

// Provide success defaults for the write-spies (the page checks response.error).
function wireWriteDefaults() {
  apiPost.mockResolvedValue({ data: {}, error: null });
  apiPut.mockResolvedValue({ data: {}, error: null });
  apiDelete.mockResolvedValue({ data: null, error: null });
}

describe("BudgetsPage — authLoading skeleton (AC-2 spinner→return null, no redirect)", () => {
  it("renders the pulse skeleton (no rows, no Add) while auth is loading", () => {
    authState.isLoading = true;
    wireApi([BUDGET_ROW]);
    const { container } = render(<BudgetsPage />);
    // Skeleton present; the table/Add/noBudgets surfaces are NOT rendered yet.
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    expect(screen.queryByText("addBudget")).not.toBeInTheDocument();
    expect(screen.queryByText("noBudgets")).not.toBeInTheDocument();
  });
});

describe("BudgetsPage — server filters (AC-4 query params)", () => {
  it("requests budgets with NO query string by default", async () => {
    wireApi([BUDGET_ROW]);
    render(<BudgetsPage />);
    await waitFor(() => {
      expect(
        apiGet.mock.calls.some(
          (c) => c[0] === "/api/v1/finance/budgets"
        )
      ).toBe(true);
    });
  });

  it("appends activityAreaId when the cost-center filter changes", async () => {
    wireApi([BUDGET_ROW]);
    render(<BudgetsPage />);
    await waitFor(() => {
      expect(screen.getByText(/1.?500/)).toBeInTheDocument();
    });
    // First combobox = the cost-center filter (filterByCostCenter).
    const areaFilter = screen.getAllByRole("combobox")[0];
    fireEvent.change(areaFilter, { target: { value: "a1" } });
    await waitFor(() => {
      expect(
        apiGet.mock.calls.some(
          (c) => c[0] === "/api/v1/finance/budgets?activityAreaId=a1"
        )
      ).toBe(true);
    });
  });

  it("appends fiscalPeriodId when the period filter changes", async () => {
    wireApi([BUDGET_ROW]);
    render(<BudgetsPage />);
    await waitFor(() => {
      expect(screen.getByText(/1.?500/)).toBeInTheDocument();
    });
    // Second combobox = the period filter (filterByPeriod).
    const periodFilter = screen.getAllByRole("combobox")[1];
    fireEvent.change(periodFilter, { target: { value: "p1" } });
    await waitFor(() => {
      expect(
        apiGet.mock.calls.some(
          (c) => c[0] === "/api/v1/finance/budgets?fiscalPeriodId=p1"
        )
      ).toBe(true);
    });
  });
});

describe("BudgetsPage — create (AC-3 write-gate, AC-4 POST)", () => {
  it("POSTs the new budget to /budgets with the selected area+period", async () => {
    wireApi([]);
    wireWriteDefaults();
    render(<BudgetsPage />);

    await waitFor(() => {
      expect(screen.getByText("addBudget")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("addBudget"));

    // Dialog combobox order: [0]=costCenter, [1]=period, [2]=currency.
    const dialogSelects = screen.getAllByRole("combobox");
    // Filters are still mounted (2) + dialog (3) → grab the LAST three.
    const selects = dialogSelects.slice(-3);
    fireEvent.change(selects[0], { target: { value: "a1" } });
    fireEvent.change(selects[1], { target: { value: "p1" } });

    const amount = screen.getByPlaceholderText("0.00");
    fireEvent.change(amount, { target: { value: "250" } });

    fireEvent.click(screen.getByText("save"));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/budgets",
        expect.objectContaining({
          activityAreaId: "a1",
          fiscalPeriodId: "p1",
          amount: 250,
          currency: "CHF",
          notes: null,
        })
      );
    });
  });
});

describe("BudgetsPage — edit (AC-3 write-gate, AC-4 PUT, A95 disabled-on-edit selects)", () => {
  it("PUTs amount/currency/notes to /budgets/{id} and keeps area/period selects disabled", async () => {
    wireApi([BUDGET_ROW]);
    wireWriteDefaults();
    render(<BudgetsPage />);

    await waitFor(() => {
      expect(screen.getByText(/1.?500/)).toBeInTheDocument();
    });
    // Open edit via the row's pencil (title=edit).
    fireEvent.click(screen.getByTitle("edit"));

    await waitFor(() => {
      expect(screen.getByText("editBudget")).toBeInTheDocument();
    });
    // A95: cost-center + period <select>s are disabled while editing (value display-only).
    const dialogSelects = screen.getAllByRole("combobox").slice(-3);
    expect(dialogSelects[0]).toBeDisabled();
    expect(dialogSelects[1]).toBeDisabled();

    fireEvent.click(screen.getByText("save"));

    await waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith(
        "/api/v1/finance/budgets/b1",
        expect.objectContaining({
          amount: 1500,
          currency: "CHF",
          notes: "Diwali",
        })
      );
    });
    // PUT payload must NOT carry activityAreaId/fiscalPeriodId (edit is amount-only).
    const payload = apiPut.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("activityAreaId");
    expect(payload).not.toHaveProperty("fiscalPeriodId");
  });
});

describe("BudgetsPage — inline two-step confirm delete (AC-5, AC-4 DELETE)", () => {
  it("first click arms the inline confirm (red), second click DELETEs /budgets/{id}", async () => {
    wireApi([BUDGET_ROW]);
    wireWriteDefaults();
    render(<BudgetsPage />);

    await waitFor(() => {
      expect(screen.getByText(/1.?500/)).toBeInTheDocument();
    });
    // First click on the trash (title=delete) arms the inline confirm; no DELETE yet.
    fireEvent.click(screen.getByTitle("delete"));
    expect(apiDelete).not.toHaveBeenCalled();

    // Inline confirm button (common.confirm) is the red destructive affordance.
    const confirmBtn = screen.getByText("confirm");
    expect(confirmBtn.className).toContain("bg-red-600");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalledWith("/api/v1/finance/budgets/b1");
    });
  });

  it("cancelling the inline confirm fires NO DELETE", async () => {
    wireApi([BUDGET_ROW]);
    wireWriteDefaults();
    render(<BudgetsPage />);

    await waitFor(() => {
      expect(screen.getByText(/1.?500/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle("delete"));
    // The inline confirm exposes a common.cancel button.
    fireEvent.click(screen.getByText("cancel"));
    expect(apiDelete).not.toHaveBeenCalled();
    // Confirm affordance retracted.
    expect(screen.queryByText("confirm")).not.toBeInTheDocument();
  });
});

describe("BudgetsPage — failure banners (AC-5 failure branch)", () => {
  it("surfaces the server error message when save (POST) returns res.error", async () => {
    wireApi([]);
    wireWriteDefaults();
    apiPost.mockResolvedValue({ data: null, error: "boom-save" });
    render(<BudgetsPage />);

    await waitFor(() => {
      expect(screen.getByText("addBudget")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("addBudget"));

    const selects = screen.getAllByRole("combobox").slice(-3);
    fireEvent.change(selects[0], { target: { value: "a1" } });
    fireEvent.change(selects[1], { target: { value: "p1" } });
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByText("save"));

    // The catch surfaces the thrown res.error verbatim (e.message), not the i18n key.
    await waitFor(() => {
      expect(screen.getByText("boom-save")).toBeInTheDocument();
    });
  });

  it("shows deleteError when delete (DELETE) rejects", async () => {
    wireApi([BUDGET_ROW]);
    wireWriteDefaults();
    apiDelete.mockResolvedValue({ data: null, error: "boom-del" });
    render(<BudgetsPage />);

    await waitFor(() => {
      expect(screen.getByText(/1.?500/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle("delete"));
    fireEvent.click(screen.getByText("confirm"));

    // handleDelete's catch maps to the i18n key (it swallows the thrown message).
    await waitFor(() => {
      expect(screen.getByText("deleteError")).toBeInTheDocument();
    });
    // Confirm stays armed (the list is NOT cleared on failure).
    expect(screen.getByText("confirm")).toBeInTheDocument();
  });
});

describe("BudgetsPage — read-only write-gate (AC-3 absence)", () => {
  it("hides the row edit/delete actions for read-only users", async () => {
    authState.canWriteFinance = false;
    wireApi([BUDGET_ROW]);
    render(<BudgetsPage />);

    await waitFor(() => {
      expect(screen.getByText(/1.?500/)).toBeInTheDocument();
    });
    expect(screen.queryByTitle("edit")).not.toBeInTheDocument();
    expect(screen.queryByTitle("delete")).not.toBeInTheDocument();
    // The actions column header is also absent.
    const rows = screen.getAllByRole("row");
    expect(within(rows[0]).queryByText("actions")).not.toBeInTheDocument();
  });
});
