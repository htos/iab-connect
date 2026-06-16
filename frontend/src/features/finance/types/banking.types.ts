// Banking/data slice types (E26-S5). Imports the S2 foundation's re-export contract
// (A83) for the shared read-lookups; adds the bank-import / transaction / receipt
// shapes the three banking/data god-pages render. NOTHING here is editable by S2 —
// this is a NEW sibling file (parallel-safe, A91/A101).
//
// The canonical `BankImportItem`/`BankImportItemStatus` DTOs live in `@/types/finance`
// and are imported DIRECTLY here (the S2 foundation re-export does not surface them and
// MUST NOT be edited). The transaction/receipt/bank-import-list shapes below are the
// god-page render contracts pinned byte-for-byte by the E26-S1 net.

export type { BankImportItem, BankImportItemStatus } from "@/types/finance";
export type { OperatingAccount, Category, ActivityArea } from "./finance.types";

// --- Bank-import list + detail (bank-import/page.tsx) ---

/** A bank-import history row (the list GET resolves `{ items: BankImport[] }`). */
export interface BankImport {
  id: string;
  importDate: string;
  fileName: string;
  status: string;
  itemCount: number;
}

import type { BankImportItem } from "@/types/finance";

/** The import-detail view (list row + its items). */
export interface BankImportDetail extends BankImport {
  items: BankImportItem[];
}

// --- Transactions (transactions/page.tsx) ---

export type TransactionType = "Income" | "Expense";

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  accountId: string;
  accountName: string;
  categoryId: string;
  categoryName: string;
  receiptId: string | null;
  reference: string;
  notes: string;
  activityAreaId: string | null;
  activityAreaName: string | null;
  activityAreaCode: string | null;
}

/** The transactions table reads only id+name for the account select. */
export interface TransactionAccount {
  id: string;
  name: string;
}

/** The transactions table reads id+name+type for the category select. */
export interface TransactionCategory {
  id: string;
  name: string;
  type: string;
}

/** The transactions activity-area select reads the full lookup (active+sorted). */
export interface TransactionActivityArea {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  sortOrder: number;
}

/** The server-side filter object the transactions list query keys on. */
export interface TransactionFilters {
  from: string;
  to: string;
  type: "" | TransactionType;
  accountId: string;
  categoryId: string;
}

/** The JSON payload POST/PUT /transactions sends (A96 — the god-page trims these). */
export interface TransactionPayload {
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  accountId: string;
  categoryId: string;
  reference: string | null;
  notes: string | null;
  activityAreaId: string | null;
}

// --- Receipts (consumed by transactions; the receipts PAGE is S3) ---

export interface Receipt {
  id: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  notes: string;
  createdAt: string;
}
