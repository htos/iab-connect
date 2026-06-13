// Receivables/payables types (E26-S3). Re-exports the canonical finance DTOs/unions
// from `@/types/finance` per A83 (consumed across finance + non-finance pages, so NOT
// relocated) and ADDS the receivables/payables view + form shapes the seven god-pages
// declared locally. `features → lib` is a legal import direction (E21 boundary).

// --- Re-exported canonical DTOs/unions from @/types/finance (A83) ---
export type {
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  RecipientType,
  CreateInvoiceRequest,
  CreateInvoiceItemRequest,
  ExpenseClaim,
  ExpenseClaimStatus,
  PaymentStatus,
  TaxCode,
  ActivityArea,
} from "@/types/finance";

import type { InvoiceStatus } from "@/types/finance";

// --- Invoices list (god-page local `Invoice` view-row; lighter than the canonical
// DTO — only the list columns + the status union used by the badge map). ---

export interface InvoiceListRow {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  recipientName: string;
  recipientType: "Member" | "External";
  subTotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  status: InvoiceStatus;
}

/** The invoices-list server filters (status/from/to are server-side; search is client). */
export type InvoiceStatusFilter = "" | InvoiceStatus;

// --- Invoice detail (god-page detail `Invoice`/`InvoiceItem`/`Payment` shapes) ---

export interface InvoiceDetailItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxCodeCode: string | null;
  taxCodeLabel: string | null;
  taxRate: number;
  isGrossEntry: boolean;
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
}

export interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  status: string;
  recipientType: string;
  recipientName: string;
  recipientAddress: string;
  subTotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  totalNet: number;
  totalTax: number;
  totalGross: number;
  items: InvoiceDetailItem[];
}

export interface InvoicePayment {
  id: string;
  date: string;
  amount: number;
  method: string;
  reference: string;
}

// --- Invoice form (new/edit) supporting shapes ---

export interface InvoiceItemForm {
  description: string;
  quantity: number;
  unitPrice: number;
  taxCodeId: string;
  taxRate: number;
  isGrossEntry: boolean;
  activityAreaId: string;
}

export interface MemberLookup {
  id: string;
  firstName: string;
  lastName: string;
}

/** Invoice-form tax-code lookup (god-page local shape — includes `label`, distinct from
 * the canonical TaxCode which the new-invoice page redeclared). */
export interface InvoiceTaxCode {
  id: string;
  code: string;
  label: string;
  rate: number;
  isDefault: boolean;
  isActive: boolean;
}

/** Invoice-form activity-area lookup (god-page local shape). */
export interface InvoiceActivityArea {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  sortOrder: number;
}

// --- Payments ---

export type PaymentMethod = "Transfer" | "Cash" | "Online";
export type PaymentDirectionType = "Income" | "Expense";

export interface Payment {
  id: string;
  date: string;
  amount: number;
  direction: string;
  method: string;
  reference: string;
  notes: string;
  invoiceId: string;
  invoiceNumber: string;
  transactionId: string | null;
  receiptId: string | null;
  status: import("@/types/finance").PaymentStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  approvalComment: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
}

export interface PaymentFormData {
  invoiceId: string;
  date: string;
  amount: number;
  direction: PaymentDirectionType;
  method: PaymentMethod;
  reference: string;
  notes: string;
}

export interface PaymentOpenInvoice {
  id: string;
  invoiceNumber: string;
  recipientName: string;
  dueDate: string;
  total: number;
  paidAmount: number;
}

// --- Receipts ---

export interface Receipt {
  id: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  notes: string;
  createdAt: string;
}

// --- Dunning ---

export interface DunningNotice {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  recipientName: string;
  level: number;
  date: string;
  dueDate: string;
  status: "Draft" | "Sent";
}

export interface DunningOverdueInvoice {
  id: string;
  invoiceNumber: string;
  recipientName: string;
  total: number;
  dueDate: string;
}

export interface DunningForm {
  invoiceId: string;
  level: number;
  dueDate: string;
}

// --- Expense claims (form + filter) ---

export interface ClaimFormData {
  title: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  receiptId: string;
}

export type ExpenseClaimStatusFilter =
  | "all"
  | import("@/types/finance").ExpenseClaimStatus;
