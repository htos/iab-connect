/**
 * REQ-044 (E6-S1): Typed contract for the finance-planning Budget API.
 * Mirrors backend DTOs (Application/Finance/Budgets). Currency is enum-as-PascalCase
 * (FinanceCurrency: "CHF" | "EUR") to match the API contract exactly.
 */

export type FinanceCurrency = "CHF" | "EUR";

export interface BudgetDto {
  id: string;
  activityAreaId: string;
  activityAreaName: string | null;
  activityAreaCode: string | null;
  fiscalPeriodId: string;
  fiscalPeriodName: string | null;
  fiscalPeriodYear: number | null;
  fiscalPeriodMonth: number | null;
  amount: number;
  currency: FinanceCurrency;
  notes: string | null;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface CreateBudgetRequest {
  activityAreaId: string;
  fiscalPeriodId: string;
  amount: number;
  currency?: FinanceCurrency | null;
  notes?: string | null;
}

export interface UpdateBudgetRequest {
  amount: number;
  currency?: FinanceCurrency | null;
  notes?: string | null;
}

export const BUDGETS_ENDPOINT = "/api/v1/finance/budgets";

// REQ-044 (E6-S3): budget-vs-actual (Soll/Ist) report.

export interface BudgetVsActualRow {
  activityAreaId: string;
  activityAreaCode: string;
  activityAreaName: string;
  budget: number;
  actual: number;
  variance: number;
  variancePercent: number;
  currency: FinanceCurrency;
}

export interface BudgetVsActualReport {
  fiscalPeriodId: string;
  fiscalPeriodName: string;
  fiscalPeriodYear: number;
  fiscalPeriodMonth: number;
  rows: BudgetVsActualRow[];
}

export const BUDGET_VS_ACTUAL_ENDPOINT =
  "/api/v1/finance/budgets/budget-vs-actual";
export const BUDGET_VS_ACTUAL_EXPORT_ENDPOINT =
  "/api/v1/finance/exports/budget-vs-actual";
