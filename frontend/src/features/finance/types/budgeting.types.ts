// Budgeting/reporting sub-slice types (E26-S4). Re-exports the `budgets`
// transport types (A83 — one import place for the slice) + the shared `ActivityArea`
// type (foundation-owned, S2) + the `ActivityAreaReport` row (canonical `@/types/finance`).
// Adds the per-page FORM value shapes (driven by the RHF+Zod schemas). `features → lib`
// and `features → @/types` are legal import directions (E21 boundary).

// --- Re-exported budget transport types from budgets (A83) ---
export type {
  BudgetDto,
  BudgetVsActualReport,
  BudgetVsActualRow,
  FinanceCurrency,
  CreateBudgetRequest,
  UpdateBudgetRequest,
} from "../api/budgets";

// --- Shared read-lookup types (foundation-owned ActivityArea; canonical report row) ---
// DEC-2 = A: the ActivityArea FULL shape lives in the S2 foundation; S4 + S6 REUSE it.
export type { ActivityArea } from "../types/finance.types";
export type { ActivityAreaReport } from "@/types/finance";

// --- Budget form (the create/edit dialog values) ---
// `amount` is a STRING in the form (the <input type=number> value), parsed on submit; the
// god-page enable-gate requires both selects + amount≥0. `currency` is the closed CHF/EUR
// set; area/period <select>s are disabled-on-edit (A95 — raw stored value retained).
import type { FinanceCurrency } from "../api/budgets";

export interface BudgetFormValues {
  activityAreaId: string;
  fiscalPeriodId: string;
  amount: string;
  currency: FinanceCurrency;
  notes: string;
}

// --- Activity-area form (create/edit; create omits isActive, edit includes it) ---
export interface ActivityAreaFormValues {
  name: string;
  code: string;
  description: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
}

// --- Category form (the modal-delete page) ---
export interface CategoryFormValues {
  name: string;
  type: "Income" | "Expense";
  color: string;
  isActive: boolean;
}

// The finance category list shape (the categories page — distinct from the posting-mappings
// `Category` read-lookup which carries only id/name/type). This carries color + isActive.
export interface FinanceCategory {
  id: string;
  name: string;
  type: "Income" | "Expense";
  color: string;
  isActive: boolean;
}

// --- Selector option shapes (subset of the full types; do NOT mint parallel area type) ---
// `ActivityAreaOption` is a SUBSET of the shared ActivityArea (DEC-2 — no parallel type);
// the selectors read id/name/code/isActive only.
export interface FiscalPeriodOption {
  id: string;
  name: string;
  year?: number;
  month?: number;
}
