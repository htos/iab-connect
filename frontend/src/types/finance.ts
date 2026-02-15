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
