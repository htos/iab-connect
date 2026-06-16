// Banking/data slice API layer (E26-S5). URL BUILDERS + query keys ONLY — no fetching
// (the hooks own every `useApiClient` call, so the E26-S1 `useApiClient`/`upload`/blob
// transport mock keeps intercepting and the net survives with ZERO transport edits —
// A94 BUILD). Imports the S2 foundation root (`FINANCE_BASE`/`financeKeys`); it NEVER
// edits S2's files (parallel-safe, A91/A101).
//
// Pinned divergences preserved byte-for-byte (E26-S1 oracle):
//   - bank-import item `/ignore` is hit by BOTH POST (handleIgnore) and PUT
//     (handleUnmatch) — SAME path string, the method split lives in the hooks.
//   - the exports JOURNAL query is built by STRING INTERPOLATION (not URLSearchParams);
//     the open-items export has no query.
//   - the transactions list `?from&to&type&accountId&categoryId` IS built with
//     URLSearchParams (and a NO-filter call emits the bare `/transactions` URL).

import { FINANCE_BASE, financeKeys, financeUrls } from "./finance-api";
import type { TransactionFilters } from "../types/banking.types";

// --- Query keys (extend the shared finance namespace via financeKeys.scope) ---

export const bankingKeys = {
  bankImports: () => ["finance", "bank-imports"] as const,
  bankImport: (id: string) =>
    ["finance", "bank-imports", "detail", id] as const,
  /**
   * The transactions list keys on the server-filter object (client search is render-time).
   * `["finance","transactions"]` is the invalidation prefix every transaction mutation
   * targets (`financeKeys.scope("transactions")`).
   */
  transactions: (filters: TransactionFilters) =>
    ["finance", "transactions", filters] as const,
  receipts: () => ["finance", "receipts"] as const,
};

// --- URL builders ---

export const bankingUrls = {
  // Bank-imports list + single-shot upload + camt upload.
  bankImports: () => `${FINANCE_BASE}/bank-imports`,
  bankImportsCamt: () => `${FINANCE_BASE}/bank-imports/camt`,
  bankImport: (id: string) => `${FINANCE_BASE}/bank-imports/${id}`,

  // Bank-import per-item actions. `ignore` is shared by POST + PUT (the method split
  // is in the hooks — DO NOT collapse to one).
  bankImportItemIgnore: (importId: string, itemId: string) =>
    `${FINANCE_BASE}/bank-imports/${importId}/items/${itemId}/ignore`,
  bankImportItemAcceptMatch: (importId: string, itemId: string) =>
    `${FINANCE_BASE}/bank-imports/${importId}/items/${itemId}/accept-match`,
  bankImportItemRejectMatch: (importId: string, itemId: string) =>
    `${FINANCE_BASE}/bank-imports/${importId}/items/${itemId}/reject-match`,
  bankImportItemMatch: (importId: string, itemId: string) =>
    `${FINANCE_BASE}/bank-imports/${importId}/items/${itemId}/match`,

  // Transactions list (server filters via URLSearchParams). A no-filter object yields
  // the bare `/transactions` URL (no trailing `?`) — pinned by the net.
  transactions: (filters?: TransactionFilters) => {
    if (!filters) return `${FINANCE_BASE}/transactions`;
    const params = new URLSearchParams();
    if (filters.from) params.append("from", filters.from);
    if (filters.to) params.append("to", filters.to);
    if (filters.type) params.append("type", filters.type);
    if (filters.accountId) params.append("accountId", filters.accountId);
    if (filters.categoryId) params.append("categoryId", filters.categoryId);
    const query = params.toString();
    return `${FINANCE_BASE}/transactions${query ? `?${query}` : ""}`;
  },
  transaction: (id: string) => `${FINANCE_BASE}/transactions/${id}`,
  transactionReceipt: (id: string) =>
    `${FINANCE_BASE}/transactions/${id}/receipt`,

  // Reference lookups the transactions page reads. categories/activityAreas reuse the
  // foundation builders (single owner — A62/A101); the resolved URL strings are identical.
  accounts: () => `${FINANCE_BASE}/accounts`,
  categories: financeUrls.categories,
  activityAreas: financeUrls.activityAreas,

  // Receipts (upload multipart, info, blob download). The receipts PAGE is S3 — here
  // only the transactions-consumed upload/info/download/list.
  receipts: () => `${FINANCE_BASE}/receipts`,
  receipt: (id: string) => `${FINANCE_BASE}/receipts/${id}`,
  receiptDownload: (id: string) => `${FINANCE_BASE}/receipts/${id}/download`,

  // Exports (blob). JOURNAL query is STRING-INTERPOLATED (NOT URLSearchParams) — pinned.
  exportsJournal: (from: string, to: string) =>
    `${FINANCE_BASE}/exports/journal?from=${from}&to=${to}`,
  exportsOpenItems: () => `${FINANCE_BASE}/exports/open-items`,
};
