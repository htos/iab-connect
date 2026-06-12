// Budgeting/reporting sub-slice API (E26-S4). OWNS the budgeting URL builders + keys
// and the activity-areas `/report` + categories WRITE builders. Imports the S2
// foundation root (`FINANCE_BASE`/`financeKeys`/`financeUrls`) + the `lib/api/budgets.ts`
// URL CONSTANTS — it NEVER edits the foundation (parallel-safe, A91/A101).
//
// DEC-1 = A: `lib/api/budgets.ts` is types+constants ONLY (no functions). This layer is
// URL builders + query keys ONLY; the hooks own the `useApiClient` calls, so the E26-S1
// `useApiClient` transport mock keeps intercepting and the characterization net survives
// the migration with ZERO transport edits (A94 BUILD case). All `/api/v1/finance/*`
// strings are byte-identical to the four god-pages — no raw URL leaks into a component.
//
// DEC-2 = A: the activity-areas FULL CRUD builders (`financeUrls.activityAreas()` /
// `financeUrls.activityArea(id)`) live in the S2 foundation — this slice REUSES them and
// re-exports them so S6's `settings/activity-areas` imports the single owner. S4 adds ONLY
// the activity-areas `/report` builder (S4 is the first writer/reporter of these).

import { FINANCE_BASE, financeKeys, financeUrls } from "./finance-api";
import {
  BUDGETS_ENDPOINT,
  BUDGET_VS_ACTUAL_ENDPOINT,
  BUDGET_VS_ACTUAL_EXPORT_ENDPOINT,
} from "@/lib/api/budgets";

/**
 * Budgeting query keys (extend the shared `financeKeys` namespace so keys never collide
 * with S2/S6). The budgets list key carries the server filters; the budget-vs-actual
 * report key carries its on-demand params; the activity-areas report key its from/to.
 */
export const budgetingKeys = {
  budgets: (filters?: { activityAreaId?: string; fiscalPeriodId?: string }) =>
    [
      "finance",
      "budgets",
      {
        activityAreaId: filters?.activityAreaId ?? "",
        fiscalPeriodId: filters?.fiscalPeriodId ?? "",
      },
    ] as const,
  budgetVsActual: (fiscalPeriodId: string, activityAreaId: string) =>
    [
      "finance",
      "budget-vs-actual",
      { fiscalPeriodId, activityAreaId },
    ] as const,
  activityAreaReport: (from: string, to: string) =>
    ["finance", "activity-areas", "report", { from, to }] as const,
  // Re-export the shared read-lookup keys (foundation-owned) so the slice imports one place.
  activityAreas: financeKeys.activityAreas,
  categories: financeKeys.categories,
  fiscalPeriods: () => ["finance", "fiscal-periods", "selector"] as const,
};

/**
 * Budgeting URL builders. Budgets list/detail + budget-vs-actual report + CSV export +
 * the activity-areas `/report` + categories CRUD. The activity-areas list/detail CRUD
 * builders are REUSED + re-exported from the foundation (DEC-2 — single owner).
 */
export const budgetingUrls = {
  // Budgets (the page builds the query string with URLSearchParams; both builders here).
  budgets: () => BUDGETS_ENDPOINT,
  budgetsFiltered: (qs: string) =>
    qs ? `${BUDGETS_ENDPOINT}?${qs}` : BUDGETS_ENDPOINT,
  budget: (id: string) => `${BUDGETS_ENDPOINT}/${id}`,

  // Budget-vs-actual on-demand report + the cross-base CSV export (NOT a JSON query).
  budgetVsActual: (qs: string) => `${BUDGET_VS_ACTUAL_ENDPOINT}?${qs}`,
  budgetVsActualExport: (qs: string) =>
    `${BUDGET_VS_ACTUAL_EXPORT_ENDPOINT}?${qs}`,

  // Activity-areas: list/detail CRUD REUSED from the foundation; S4 owns only /report.
  activityAreas: financeUrls.activityAreas,
  activityArea: financeUrls.activityArea,
  activityAreaReport: (from: string, to: string) =>
    `${FINANCE_BASE}/activity-areas/report?from=${from}&to=${to}`,

  // Categories: GET list REUSED from the foundation; S4 owns the CRUD builders.
  categories: financeUrls.categories,
  category: (id: string) => `${FINANCE_BASE}/categories/${id}`,

  // Fiscal-periods selector (unfiltered list — the budget/report selectors GET this).
  fiscalPeriods: () => `${FINANCE_BASE}/fiscal-periods`,
};
