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

// --- Pagination ---

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
