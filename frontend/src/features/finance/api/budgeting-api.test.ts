import { describe, expect, it } from "vitest";

/**
 * E26-S4: the budgeting sub-slice api owns the budgeting URL builders + keys and REUSES
 * the foundation's activity-areas CRUD builders. These pin every `/api/v1/finance/*` URL
 * byte-identically to the four god-pages (budgets list/detail, the budget-vs-actual
 * on-demand report, the cross-base `/exports/budget-vs-actual` CSV, the activity-areas
 * `/report?from=&to=`, and categories CRUD) — the slice hooks consume these, so the
 * shapes are a contract.
 */

import { budgetingKeys, budgetingUrls } from "./budgeting-api";
import { financeUrls } from "./finance-api";

describe("budgetingUrls — budgets", () => {
  it("builds the unfiltered + filtered + detail budget URLs", () => {
    expect(budgetingUrls.budgets()).toBe("/api/v1/finance/budgets");
    expect(budgetingUrls.budgetsFiltered("")).toBe("/api/v1/finance/budgets");
    expect(budgetingUrls.budgetsFiltered("activityAreaId=a1")).toBe(
      "/api/v1/finance/budgets?activityAreaId=a1"
    );
    expect(budgetingUrls.budgetsFiltered("fiscalPeriodId=p1")).toBe(
      "/api/v1/finance/budgets?fiscalPeriodId=p1"
    );
    expect(budgetingUrls.budget("b1")).toBe("/api/v1/finance/budgets/b1");
  });
});

describe("budgetingUrls — budget-vs-actual + cross-base CSV export", () => {
  it("builds the on-demand report URL under /budgets", () => {
    expect(budgetingUrls.budgetVsActual("fiscalPeriodId=p1")).toBe(
      "/api/v1/finance/budgets/budget-vs-actual?fiscalPeriodId=p1"
    );
    expect(
      budgetingUrls.budgetVsActual("fiscalPeriodId=p1&activityAreaId=a1")
    ).toBe(
      "/api/v1/finance/budgets/budget-vs-actual?fiscalPeriodId=p1&activityAreaId=a1"
    );
  });

  it("builds the CSV export under the CROSS-BASE /exports path (not /budgets)", () => {
    expect(budgetingUrls.budgetVsActualExport("fiscalPeriodId=p1")).toBe(
      "/api/v1/finance/exports/budget-vs-actual?fiscalPeriodId=p1"
    );
  });
});

describe("budgetingUrls — activity-areas (REUSE foundation CRUD + own /report)", () => {
  it("re-uses the foundation activity-areas list/detail builders (single owner, DEC-2)", () => {
    // Identity: the slice does NOT re-declare /activity-areas — it points at the foundation.
    expect(budgetingUrls.activityAreas).toBe(financeUrls.activityAreas);
    expect(budgetingUrls.activityArea).toBe(financeUrls.activityArea);
    expect(budgetingUrls.activityAreas()).toBe(
      "/api/v1/finance/activity-areas"
    );
    expect(budgetingUrls.activityArea("a1")).toBe(
      "/api/v1/finance/activity-areas/a1"
    );
  });

  it("owns the activity-areas /report?from=&to= builder", () => {
    expect(budgetingUrls.activityAreaReport("2026-01-01", "2026-12-31")).toBe(
      "/api/v1/finance/activity-areas/report?from=2026-01-01&to=2026-12-31"
    );
  });
});

describe("budgetingUrls — categories (REUSE foundation GET + own CRUD)", () => {
  it("re-uses the foundation categories GET-list builder and owns the detail builder", () => {
    expect(budgetingUrls.categories).toBe(financeUrls.categories);
    expect(budgetingUrls.categories()).toBe("/api/v1/finance/categories");
    expect(budgetingUrls.category("c1")).toBe("/api/v1/finance/categories/c1");
  });
});

describe("budgetingUrls — fiscal-periods selector", () => {
  it("builds the unfiltered fiscal-periods list (the budget/report selectors GET this)", () => {
    expect(budgetingUrls.fiscalPeriods()).toBe(
      "/api/v1/finance/fiscal-periods"
    );
  });
});

describe("budgetingKeys", () => {
  it("namespaces the budgets list key with the server filters", () => {
    expect(budgetingKeys.budgets()).toEqual([
      "finance",
      "budgets",
      { activityAreaId: "", fiscalPeriodId: "" },
    ]);
    expect(
      budgetingKeys.budgets({ activityAreaId: "a1", fiscalPeriodId: "p1" })
    ).toEqual([
      "finance",
      "budgets",
      { activityAreaId: "a1", fiscalPeriodId: "p1" },
    ]);
  });

  it("namespaces the budget-vs-actual + activity-area report keys", () => {
    expect(budgetingKeys.budgetVsActual("p1", "a1")).toEqual([
      "finance",
      "budget-vs-actual",
      { fiscalPeriodId: "p1", activityAreaId: "a1" },
    ]);
    expect(
      budgetingKeys.activityAreaReport("2026-01-01", "2026-12-31")
    ).toEqual([
      "finance",
      "activity-areas",
      "report",
      { from: "2026-01-01", to: "2026-12-31" },
    ]);
  });

  it("re-exports the shared read-lookup keys (foundation-owned)", () => {
    expect(budgetingKeys.activityAreas()).toEqual([
      "finance",
      "activity-areas",
    ]);
    expect(budgetingKeys.categories()).toEqual(["finance", "categories"]);
  });
});
