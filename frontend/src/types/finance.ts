/**
 * Finance type definitions
 * REQ-062: VAT/MWST types
 */

// --- Tax Codes ---

export interface TaxCode {
  id: string;
  code: string;
  label: string;
  rate: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaxCodeRequest {
  code: string;
  label: string;
  rate: number;
  isDefault: boolean;
}

export interface UpdateTaxCodeRequest {
  code: string;
  label: string;
  rate: number;
  isDefault: boolean;
}

// --- Invoice Items (with VAT fields) ---

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxCodeId: string | null;
  taxCodeCode: string | null;
  taxCodeLabel: string | null;
  taxRate: number;
  isGrossEntry: boolean;
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
}

export interface CreateInvoiceItemRequest {
  description: string;
  quantity: number;
  unitPrice: number;
  taxCodeId?: string | null;
  isGrossEntry?: boolean;
}

// --- Invoice (with VAT totals) ---

export type InvoiceStatus = "Draft" | "Sent" | "Paid" | "Overdue" | "Cancelled";
export type RecipientType = "Member" | "External";

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  status: InvoiceStatus;
  recipientType: RecipientType;
  recipientName: string;
  recipientAddress: string;
  subTotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  totalNet: number;
  totalTax: number;
  totalGross: number;
  items: InvoiceItem[];
}

export interface CreateInvoiceRequest {
  date: string;
  dueDate: string;
  recipientType: RecipientType;
  recipientId?: string;
  recipientName: string;
  recipientAddress?: string;
  items: CreateInvoiceItemRequest[];
}

// REQ-067: Payment Approval
export type PaymentStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Paid';

// REQ-067: Expense Claims
export type ExpenseClaimStatus = 'Draft' | 'Submitted' | 'UnderReview' | 'Approved' | 'Rejected' | 'Reimbursed';

export interface ExpenseClaim {
  id: string;
  title: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  status: ExpenseClaimStatus;
  claimantId: string;
  claimantName: string;
  receiptId: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  approvalComment: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  paymentId: string | null;
  reimbursedAt: string | null;
  reimbursedBy: string | null;
  createdAt: string;
  createdBy: string;
}

// REQ-064: Invoice Templates
export interface InvoiceTemplate {
  id: string;
  name: string;
  jurisdiction: string;
  countryCode: string | null;
  isDefault: boolean;
  showVatId: boolean;
  showTaxExemptionNote: boolean;
  taxExemptionNote: string | null;
  showReverseChargeNote: boolean;
  reverseChargeNote: string | null;
  showPaymentTerms: boolean;
  defaultPaymentTerms: string | null;
  showBankDetails: boolean;
  logoUrl: string | null;
  headerText: string | null;
  footerText: string | null;
  legalNotice: string | null;
  language: string;
}

// REQ-066: Fiscal Periods
export type FiscalPeriodStatus = 'Open' | 'Closed' | 'Locked';

export interface FiscalPeriod {
  id: string;
  name: string;
  year: number;
  month: number;
  startDate: string;
  endDate: string;
  status: FiscalPeriodStatus;
  lockedAt: string | null;
  lockedBy: string | null;
  unlockedAt: string | null;
  unlockedBy: string | null;
  lockNotes: string | null;
  totalIncome: number | null;
  totalExpense: number | null;
  closingBalance: number | null;
}

// REQ-069: Bank Import Item (with ISO 20022 camt fields)
export type BankImportItemStatus = 'Unmatched' | 'Matched' | 'Ignored';

export interface BankImportItem {
  id: string;
  transactionDate: string;
  description: string;
  amount: number;
  iban: string | null;
  reference: string | null;
  status: BankImportItemStatus;
  paymentId: string | null;
  endToEndId: string | null;
  creditorReference: string | null;
  remittanceInfo: string | null;
  debtorName: string | null;
  debtorIban: string | null;
  suggestedInvoiceId: string | null;
  matchConfidence: number | null;
}

// REQ-068: Activity Areas
export interface ActivityArea {
  id: string;
  name: string;
  code: string;
  description: string | null;
  color: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface ActivityAreaReport {
  activityAreaId: string | null;
  activityAreaName: string | null;
  activityAreaCode: string | null;
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

// --- REQ-074..085: Double-Entry Bookkeeping ---

export type AccountingMode = "SimpleCash" | "DoubleEntry";

export type LedgerAccountClass = "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";
export type NormalBalance = "Debit" | "Credit";
export type JournalEntryStatus = "Draft" | "Posted" | "Reversed";
export type PostingMappingType = "Category" | "Account" | "TaxCode";

export interface LedgerAccount {
  id: string;
  financeProfileId: string;
  number: string;
  name: string;
  accountClass: LedgerAccountClass;
  normalBalance: NormalBalance;
  description: string | null;
  parentAccountId: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface CreateLedgerAccountRequest {
  number: string;
  name: string;
  accountClass: LedgerAccountClass;
  normalBalance: NormalBalance;
  description?: string | null;
  parentAccountId?: string | null;
  sortOrder?: number;
}

export interface UpdateLedgerAccountRequest {
  number: string;
  name: string;
  accountClass: LedgerAccountClass;
  normalBalance: NormalBalance;
  description?: string | null;
  parentAccountId?: string | null;
  sortOrder?: number;
}

export interface JournalEntryLine {
  id: string;
  ledgerAccountId: string;
  ledgerAccountNumber: string;
  ledgerAccountName: string;
  debitAmount: number;
  creditAmount: number;
  taxCodeId: string | null;
  taxCodeCode: string | null;
  netAmount: number;
  taxAmount: number;
  activityAreaId: string | null;
  activityAreaName: string | null;
}

export interface JournalEntry {
  id: string;
  financeProfileId: string;
  date: string;
  description: string;
  reference: string | null;
  status: JournalEntryStatus;
  sourceType: string | null;
  sourceId: string | null;
  fiscalPeriodId: string | null;
  lines: JournalEntryLine[];
  createdAt: string;
  createdBy: string;
}

export interface CreateJournalEntryLineRequest {
  ledgerAccountId: string;
  debitAmount: number;
  creditAmount: number;
  taxCodeId?: string | null;
  netAmount?: number;
  taxAmount?: number;
  activityAreaId?: string | null;
}

export interface CreateJournalEntryRequest {
  date: string;
  description: string;
  reference?: string | null;
  fiscalPeriodId?: string | null;
  lines: CreateJournalEntryLineRequest[];
}

export interface PostingMapping {
  id: string;
  financeProfileId: string;
  mappingType: PostingMappingType;
  sourceId: string;
  ledgerAccountId: string;
  ledgerAccountNumber: string;
  ledgerAccountName: string;
  taxLedgerAccountId: string | null;
  taxLedgerAccountNumber: string | null;
  taxLedgerAccountName: string | null;
}

export interface CreatePostingMappingRequest {
  mappingType: PostingMappingType;
  sourceId: string;
  ledgerAccountId: string;
  taxLedgerAccountId?: string | null;
}

export interface UpdatePostingMappingRequest {
  ledgerAccountId: string;
  taxLedgerAccountId?: string | null;
}

// --- Accounting Reports ---

export interface TrialBalanceRow {
  ledgerAccountId: string;
  accountNumber: string;
  accountName: string;
  accountClass: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
}

export interface TrialBalanceReport {
  from: string | null;
  to: string | null;
  lines: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
}

export interface BalanceSheetRow {
  ledgerAccountId: string;
  accountNumber: string;
  accountName: string;
  accountClass: string;
  balance: number;
}

export interface BalanceSheetReport {
  asOfDate: string;
  assets: BalanceSheetRow[];
  liabilities: BalanceSheetRow[];
  equity: BalanceSheetRow[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}

export interface ProfitAndLossRow {
  ledgerAccountId: string;
  accountNumber: string;
  accountName: string;
  amount: number;
}

export interface ProfitAndLossReport {
  from: string | null;
  to: string | null;
  revenue: ProfitAndLossRow[];
  expenses: ProfitAndLossRow[];
  totalRevenue: number;
  totalExpenses: number;
  netResult: number;
}

// --- Pagination (re-exported from common) ---

export type { PagedResult } from './common';
