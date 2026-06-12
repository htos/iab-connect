// Receivables/payables API layer (E26-S3). ADDS its own URL builders + query keys on
// top of the S2 foundation (`FINANCE_BASE` + `financeKeys` root) — it does NOT edit
// `finance-api.ts` (parallel-safe, A91/A101).
//
// This layer is URL BUILDERS + query keys ONLY — no fetching. The hooks own the
// `useApiClient` calls so the E26-S1 `useApiClient` transport mock keeps intercepting
// and the characterization net survives the migration with ZERO transport edits (A94
// BUILD case). All `/api/v1/finance/*` strings (+ the non-finance `/api/v1/members`
// lookup) are byte-identical to the seven god-pages, INCLUDING the two cancel-endpoint
// divergence: the LIST cancel is `DELETE /invoices/{id}` (`invoice(id)`), while the
// DETAIL cancel is `POST /invoices/{id}/cancel` (`invoiceCancel(id)`).

import { FINANCE_BASE, financeKeys, financeUrls } from "./finance-api";

export { FINANCE_BASE, financeKeys };

/**
 * Receivables/payables query keys, namespaced under the shared finance root via
 * `financeKeys.scope(...)` so they never collide with S2/S4/S6 keys.
 */
export const receivablesKeys = {
  // Object-bearing keys are built directly under the finance root (the `scope` helper only
  // takes string|number parts); the leading "finance" segment keeps them namespaced.
  invoices: (status: string, from: string, to: string) =>
    ["finance", "invoices", "list", { status, from, to }] as const,
  invoicesOpen: () => financeKeys.scope("invoices", "open"),
  invoice: (id: string) => financeKeys.scope("invoices", "detail", id),
  invoicePayments: (id: string) =>
    financeKeys.scope("invoices", "detail", id, "payments"),
  payments: () => financeKeys.scope("payments"),
  receipts: () => financeKeys.scope("receipts"),
  dunning: () => financeKeys.scope("dunning"),
  expenseClaims: (status: string, myClaimsOnly: boolean) =>
    ["finance", "expense-claims", "list", { status, myClaimsOnly }] as const,
  members: () => financeKeys.scope("members", "lookup"),
};

/** Build the `?status=&from=&to=` invoices-list query string (god-page parity). */
function invoiceListQuery(status?: string, from?: string, to?: string): string {
  const params = new URLSearchParams();
  if (status) params.append("status", status);
  if (from) params.append("from", from);
  if (to) params.append("to", to);
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Build the `?status=&myClaimsOnly=` expense-claims query string (god-page parity). */
function expenseClaimsQuery(status?: string, myClaimsOnly?: boolean): string {
  const params = new URLSearchParams();
  if (status && status !== "all") params.set("status", status);
  if (myClaimsOnly) params.set("myClaimsOnly", "true");
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const receivablesUrls = {
  // --- Invoices (list + detail + actions + blob endpoints) ---
  invoices: (status?: string, from?: string, to?: string) =>
    `${FINANCE_BASE}/invoices${invoiceListQuery(status, from, to)}`,
  invoicesOpen: () => `${FINANCE_BASE}/invoices/open`,
  invoice: (id: string) => `${FINANCE_BASE}/invoices/${id}`,
  invoiceCreate: () => `${FINANCE_BASE}/invoices`,
  invoiceSend: (id: string) => `${FINANCE_BASE}/invoices/${id}/send`,
  // DETAIL cancel = POST /invoices/{id}/cancel (divergence vs the list's DELETE).
  invoiceCancel: (id: string) => `${FINANCE_BASE}/invoices/${id}/cancel`,
  invoicePdf: (id: string) => `${FINANCE_BASE}/invoices/${id}/pdf`,
  invoiceEInvoice: (id: string) =>
    `${FINANCE_BASE}/invoices/${id}/einvoice?format=ubl`,
  // detail page reads invoiceId-scoped payment history
  invoicePayments: (id: string) => `${FINANCE_BASE}/payments?invoiceId=${id}`,

  // --- Payments (CRUD + workflow + receipt attach/detach) ---
  payments: () => `${FINANCE_BASE}/payments`,
  payment: (id: string) => `${FINANCE_BASE}/payments/${id}`,
  paymentSubmit: (id: string) => `${FINANCE_BASE}/payments/${id}/submit`,
  paymentApprove: (id: string) => `${FINANCE_BASE}/payments/${id}/approve`,
  paymentReject: (id: string) => `${FINANCE_BASE}/payments/${id}/reject`,
  paymentMarkPaid: (id: string) => `${FINANCE_BASE}/payments/${id}/mark-paid`,
  paymentReceipt: (id: string) => `${FINANCE_BASE}/payments/${id}/receipt`,

  // --- Receipts (list + upload + download + detail + delete) ---
  receipts: () => `${FINANCE_BASE}/receipts`,
  receipt: (id: string) => `${FINANCE_BASE}/receipts/${id}`,
  receiptDownload: (id: string) => `${FINANCE_BASE}/receipts/${id}/download`,

  // --- Dunning (list + create + send) ---
  dunning: () => `${FINANCE_BASE}/dunning`,
  dunningSend: (id: string) => `${FINANCE_BASE}/dunning/${id}/send`,

  // --- Expense claims (list + CRUD + workflow) ---
  expenseClaims: (status?: string, myClaimsOnly?: boolean) =>
    `${FINANCE_BASE}/expense-claims${expenseClaimsQuery(status, myClaimsOnly)}`,
  expenseClaimCreate: () => `${FINANCE_BASE}/expense-claims`,
  expenseClaim: (id: string) => `${FINANCE_BASE}/expense-claims/${id}`,
  expenseClaimSubmit: (id: string) =>
    `${FINANCE_BASE}/expense-claims/${id}/submit`,
  expenseClaimReview: (id: string) =>
    `${FINANCE_BASE}/expense-claims/${id}/review`,
  expenseClaimApprove: (id: string) =>
    `${FINANCE_BASE}/expense-claims/${id}/approve`,
  expenseClaimReject: (id: string) =>
    `${FINANCE_BASE}/expense-claims/${id}/reject`,
  expenseClaimReimburse: (id: string) =>
    `${FINANCE_BASE}/expense-claims/${id}/reimburse`,

  // --- Non-finance members lookup (invoices/new recipient dropdown) ---
  members: () => `/api/v1/members?pageSize=500`,

  // --- Shared finance read-lookups consumed here (reuse the S2 foundation builders —
  // single owner, A62/A101; the resolved URL strings are identical) ---
  taxCodes: financeUrls.taxCodes,
  activityAreas: financeUrls.activityAreas,
};
