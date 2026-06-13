// Finance feature API foundation (E26-S2 — OWNS the shared finance api layer).
//
// DEC-1 = A (A91): ONE `financeKeys` root + `FINANCE_BASE` live here; later stories
// (S3..S6) add their OWN `<sub>-api.ts` importing this root — nobody edits this file
// after S2, so the slice extractions stay parallel-safe (no merge contention).
//
// This layer is URL BUILDERS + query keys ONLY — it does NO fetching. The hooks own the
// `useApiClient` calls, so the E26-S1 `useApiClient` transport mock keeps intercepting
// and the characterization net survives the migration with ZERO transport edits (A94
// BUILD case). All `/api/v1/finance/*` strings live here — no raw URL leaks into a
// component (E21-S1 rule 5). URLs are byte-identical to the seven god-pages.

export const FINANCE_BASE = "/api/v1/finance";

/**
 * Root query-key factory for the whole finance feature. `all` is the namespace root a
 * blanket invalidation can target; `scope(...)` is the stable namespacing helper each
 * sub-resource (and each later sub-slice) extends so keys never collide across S2..S6.
 *
 * Examples:
 *   financeKeys.scope("accounts")                 → ["finance", "accounts"]
 *   financeKeys.scope("journal-entries", status)  → ["finance", "journal-entries", "Draft"]
 */
export const financeKeys = {
  all: ["finance"] as const,
  scope: (...parts: ReadonlyArray<string | number>) =>
    ["finance", ...parts] as const,

  // Per-resource keys (S2 ledger/accounting + shared lookups).
  dashboard: () => ["finance", "dashboard"] as const,
  accounts: () => ["finance", "accounts"] as const,
  ledgerAccounts: () => ["finance", "ledger-accounts"] as const,
  journalEntries: (status: string) =>
    ["finance", "journal-entries", { status }] as const,
  journalEntry: (id: string) =>
    ["finance", "journal-entries", "detail", id] as const,
  fiscalPeriods: (year: number) =>
    ["finance", "fiscal-periods", { year }] as const,
  postingMappings: () => ["finance", "posting-mappings"] as const,
  accountingReport: (
    report: "trial-balance" | "balance-sheet" | "profit-and-loss",
    params: Record<string, string>
  ) => ["finance", "accounting-reports", report, params] as const,
  profile: () => ["finance", "profile"] as const,
  // Shared read-lookups (S2 owns the GET keys; S4/S6 reuse them).
  activityAreas: () => ["finance", "activity-areas"] as const,
  taxCodes: () => ["finance", "tax-codes"] as const,
  categories: () => ["finance", "categories"] as const,
};

// --- Dashboard (finance/page.tsx) ---

export const financeUrls = {
  // Dashboard composite (4 GETs).
  transactionsSummary: () => `${FINANCE_BASE}/transactions/summary`,
  dashboard: () => `${FINANCE_BASE}/dashboard`,
  invoicesOpen: () => `${FINANCE_BASE}/invoices/open`,
  transactions: () => `${FINANCE_BASE}/transactions`,

  // Operating accounts (cash/bank).
  accounts: () => `${FINANCE_BASE}/accounts`,
  account: (id: string) => `${FINANCE_BASE}/accounts/${id}`,

  // Ledger accounts (double-entry chart of accounts).
  ledgerAccounts: () => `${FINANCE_BASE}/ledger-accounts`,
  ledgerAccount: (id: string) => `${FINANCE_BASE}/ledger-accounts/${id}`,

  // Journal entries (incl. ?status=, detail, post, reverse).
  journalEntries: (status?: string) =>
    status
      ? `${FINANCE_BASE}/journal-entries?status=${status}`
      : `${FINANCE_BASE}/journal-entries`,
  journalEntry: (id: string) => `${FINANCE_BASE}/journal-entries/${id}`,
  journalEntryPost: (id: string) =>
    `${FINANCE_BASE}/journal-entries/${id}/post`,
  journalEntryReverse: (id: string) =>
    `${FINANCE_BASE}/journal-entries/${id}/reverse`,

  // Accounting reports (query params built by URLSearchParams in the hooks).
  trialBalance: (qs: string) =>
    `${FINANCE_BASE}/accounting-reports/trial-balance?${qs}`,
  balanceSheet: (qs: string) =>
    `${FINANCE_BASE}/accounting-reports/balance-sheet?${qs}`,
  profitAndLoss: (qs: string) =>
    `${FINANCE_BASE}/accounting-reports/profit-and-loss?${qs}`,

  // Fiscal periods (?year= + generate + per-id actions).
  fiscalPeriods: (year: number) =>
    `${FINANCE_BASE}/fiscal-periods?year=${year}`,
  fiscalPeriodsGenerate: () => `${FINANCE_BASE}/fiscal-periods/generate`,
  fiscalPeriodClose: (id: string) =>
    `${FINANCE_BASE}/fiscal-periods/${id}/close`,
  fiscalPeriodReopen: (id: string) =>
    `${FINANCE_BASE}/fiscal-periods/${id}/reopen`,
  fiscalPeriodLock: (id: string) => `${FINANCE_BASE}/fiscal-periods/${id}/lock`,
  fiscalPeriodUnlock: (id: string) =>
    `${FINANCE_BASE}/fiscal-periods/${id}/unlock`,

  // Posting mappings.
  postingMappings: () => `${FINANCE_BASE}/posting-mappings`,
  postingMapping: (id: string) => `${FINANCE_BASE}/posting-mappings/${id}`,

  // Profile (DoubleEntry mode guard).
  profile: () => `${FINANCE_BASE}/profile`,

  // --- Shared read-lookup + write surface OWNED by the foundation ---
  // activity-areas: FULL CRUD builders (S6 imports as-is; S4 adds only /report).
  activityAreas: () => `${FINANCE_BASE}/activity-areas`,
  activityArea: (id: string) => `${FINANCE_BASE}/activity-areas/${id}`,
  // tax-codes: GET list only here (S6 owns tax-codes CRUD in its own settings-api.ts).
  taxCodes: () => `${FINANCE_BASE}/tax-codes`,
  // categories: GET list only here (S4 owns categories CRUD in budgeting-api.ts).
  categories: () => `${FINANCE_BASE}/categories`,
};
