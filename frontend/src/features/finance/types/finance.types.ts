// Finance feature types (E26-S2). DEC-2 = A (A83): the canonical finance DTOs/unions
// live in `@/types/finance` and are consumed across the whole app (finance + non-finance
// pages), so they are NOT relocated — they are RE-EXPORTED here so every finance slice
// (S2..S6) imports its types from ONE place (`features/finance/types`). New ledger/
// accounting/dashboard/profile shapes + the shared read-lookup types (ActivityArea /
// TaxCode / Category) that S2's journal-entries + posting-mappings consume — and that
// S4/S6 REUSE rather than redeclare — are added here.
//
// `features → lib` is a legal import direction (E21 boundary); `lib → features` is not.

// --- Re-exported canonical DTOs/unions from @/types/finance (A83) ---
export type {
  // Ledger / double-entry core (REQ-074..085)
  AccountingMode,
  LedgerAccountClass,
  NormalBalance,
  JournalEntryStatus,
  PostingMappingType,
  LedgerAccount,
  CreateLedgerAccountRequest,
  UpdateLedgerAccountRequest,
  JournalEntry,
  JournalEntryLine,
  CreateJournalEntryRequest,
  CreateJournalEntryLineRequest,
  PostingMapping,
  CreatePostingMappingRequest,
  UpdatePostingMappingRequest,
  // Accounting reports
  TrialBalanceReport,
  TrialBalanceRow,
  BalanceSheetReport,
  BalanceSheetRow,
  ProfitAndLossReport,
  ProfitAndLossRow,
  // Fiscal periods (REQ-066)
  FiscalPeriod,
  FiscalPeriodStatus,
  // Shared read-lookups consumed by S2 (and reused by S4/S6)
  ActivityArea,
  TaxCode,
} from "@/types/finance";

// --- Dashboard composite (finance/page.tsx) ---

export interface TransactionSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export interface FinanceDashboard {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  invoicesTotalOutstanding: number;
  invoicesOverdueCount: number;
  invoicesOverdueAmount: number;
  invoicesOpenCount: number;
  paymentsTotalPending: number;
  paymentsTotalPaid: number;
  paymentsPendingCount: number;
  expenseClaimsTotalPending: number;
  expenseClaimsTotalReimbursed: number;
  expenseClaimsPendingCount: number;
  currentFiscalPeriod: string | null;
  currentPeriodStatus: string | null;
}

export interface OpenInvoice {
  id: string;
  total: number;
}

export interface OpenInvoicesSummary {
  count: number;
  totalAmount: number;
}

export interface DashboardTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "Income" | "Expense";
  categoryName: string;
  accountName: string;
}

/** The four GETs the dashboard composite query resolves into one bag. */
export interface FinanceDashboardData {
  summary: TransactionSummary | null;
  dashboard: FinanceDashboard | null;
  openInvoices: OpenInvoicesSummary | null;
  recentTransactions: DashboardTransaction[];
}

// --- Operating-account (finance/accounts.tsx) — the cash/bank "Account" shape ---
// Distinct from the double-entry LedgerAccount; this is the operating account list.

export type OperatingAccountType = "Cash" | "Bank" | "Other";

export interface OperatingAccount {
  id: string;
  name: string;
  number: string;
  type: OperatingAccountType;
  description: string;
  isActive: boolean;
  sortOrder: number;
}

export interface OperatingAccountForm {
  name: string;
  number: string;
  type: OperatingAccountType;
  description: string;
  isActive: boolean;
  sortOrder: number;
}

// --- Finance profile (DoubleEntry mode guard) ---

export interface FinanceProfile {
  accountingMode?: string;
}

// --- Shared read-lookup: Category (posting-mappings lookup; S4 owns CRUD) ---

export interface Category {
  id: string;
  name: string;
  type: string;
}
