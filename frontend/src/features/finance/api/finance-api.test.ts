import { describe, expect, it } from "vitest";

/**
 * E26-S2: the finance foundation api owns the URL builders + the `financeKeys` root.
 * These pin every `/api/v1/finance/*` URL byte-identically to the seven god-pages
 * (incl. the journal post/reverse action sub-paths, the `?status=` / `?year=` query
 * builders, and the fiscal-period close/reopen/lock/unlock actions) and the shared
 * read-lookup CRUD builders the foundation owns (activity-areas FULL CRUD, tax-codes /
 * categories GET). S3..S6 import these builders, so the shapes are a contract.
 */

import { FINANCE_BASE, financeKeys, financeUrls } from "./finance-api";

describe("FINANCE_BASE", () => {
  it("is /api/v1/finance", () => {
    expect(FINANCE_BASE).toBe("/api/v1/finance");
  });
});

describe("financeKeys root factory", () => {
  it("exposes the namespace root + stable scope helper", () => {
    expect(financeKeys.all).toEqual(["finance"]);
    expect(financeKeys.scope("accounts")).toEqual(["finance", "accounts"]);
    expect(financeKeys.scope("journal-entries", "Draft")).toEqual([
      "finance",
      "journal-entries",
      "Draft",
    ]);
  });

  it("keys each resource under the finance namespace", () => {
    expect(financeKeys.dashboard()).toEqual(["finance", "dashboard"]);
    expect(financeKeys.accounts()).toEqual(["finance", "accounts"]);
    expect(financeKeys.ledgerAccounts()).toEqual([
      "finance",
      "ledger-accounts",
    ]);
    expect(financeKeys.journalEntries("Draft")).toEqual([
      "finance",
      "journal-entries",
      { status: "Draft" },
    ]);
    expect(financeKeys.journalEntry("j1")).toEqual([
      "finance",
      "journal-entries",
      "detail",
      "j1",
    ]);
    expect(financeKeys.fiscalPeriods(2026)).toEqual([
      "finance",
      "fiscal-periods",
      { year: 2026 },
    ]);
    expect(financeKeys.postingMappings()).toEqual([
      "finance",
      "posting-mappings",
    ]);
    expect(
      financeKeys.accountingReport("trial-balance", { from: "", to: "" })
    ).toEqual([
      "finance",
      "accounting-reports",
      "trial-balance",
      { from: "", to: "" },
    ]);
    expect(financeKeys.profile()).toEqual(["finance", "profile"]);
    expect(financeKeys.activityAreas()).toEqual(["finance", "activity-areas"]);
    expect(financeKeys.taxCodes()).toEqual(["finance", "tax-codes"]);
    expect(financeKeys.categories()).toEqual(["finance", "categories"]);
  });
});

describe("financeUrls — dashboard composite", () => {
  it("builds the four dashboard GET URLs", () => {
    expect(financeUrls.transactionsSummary()).toBe(
      "/api/v1/finance/transactions/summary"
    );
    expect(financeUrls.dashboard()).toBe("/api/v1/finance/dashboard");
    expect(financeUrls.invoicesOpen()).toBe("/api/v1/finance/invoices/open");
    expect(financeUrls.transactions()).toBe("/api/v1/finance/transactions");
  });
});

describe("financeUrls — accounts (operating) + ledger-accounts", () => {
  it("builds list + detail URLs", () => {
    expect(financeUrls.accounts()).toBe("/api/v1/finance/accounts");
    expect(financeUrls.account("a1")).toBe("/api/v1/finance/accounts/a1");
    expect(financeUrls.ledgerAccounts()).toBe(
      "/api/v1/finance/ledger-accounts"
    );
    expect(financeUrls.ledgerAccount("l1")).toBe(
      "/api/v1/finance/ledger-accounts/l1"
    );
  });
});

describe("financeUrls — journal-entries (?status=, detail, post, reverse)", () => {
  it("builds the unfiltered + status-filtered list URLs", () => {
    expect(financeUrls.journalEntries()).toBe(
      "/api/v1/finance/journal-entries"
    );
    expect(financeUrls.journalEntries("Draft")).toBe(
      "/api/v1/finance/journal-entries?status=Draft"
    );
  });

  it("builds the detail + post + reverse action sub-paths", () => {
    expect(financeUrls.journalEntry("j1")).toBe(
      "/api/v1/finance/journal-entries/j1"
    );
    expect(financeUrls.journalEntryPost("j1")).toBe(
      "/api/v1/finance/journal-entries/j1/post"
    );
    expect(financeUrls.journalEntryReverse("j2")).toBe(
      "/api/v1/finance/journal-entries/j2/reverse"
    );
  });
});

describe("financeUrls — accounting-reports", () => {
  it("builds the three report URLs with a query string", () => {
    expect(financeUrls.trialBalance("from=2026-01-01&to=2026-12-31")).toBe(
      "/api/v1/finance/accounting-reports/trial-balance?from=2026-01-01&to=2026-12-31"
    );
    expect(financeUrls.balanceSheet("asOfDate=2026-06-12")).toBe(
      "/api/v1/finance/accounting-reports/balance-sheet?asOfDate=2026-06-12"
    );
    expect(financeUrls.profitAndLoss("")).toBe(
      "/api/v1/finance/accounting-reports/profit-and-loss?"
    );
  });
});

describe("financeUrls — fiscal-periods (?year=, generate, actions)", () => {
  it("builds the ?year= list + generate + per-id action sub-paths", () => {
    expect(financeUrls.fiscalPeriods(2026)).toBe(
      "/api/v1/finance/fiscal-periods?year=2026"
    );
    expect(financeUrls.fiscalPeriodsGenerate()).toBe(
      "/api/v1/finance/fiscal-periods/generate"
    );
    expect(financeUrls.fiscalPeriodClose("p1")).toBe(
      "/api/v1/finance/fiscal-periods/p1/close"
    );
    expect(financeUrls.fiscalPeriodReopen("p1")).toBe(
      "/api/v1/finance/fiscal-periods/p1/reopen"
    );
    expect(financeUrls.fiscalPeriodLock("p1")).toBe(
      "/api/v1/finance/fiscal-periods/p1/lock"
    );
    expect(financeUrls.fiscalPeriodUnlock("p1")).toBe(
      "/api/v1/finance/fiscal-periods/p1/unlock"
    );
  });
});

describe("financeUrls — posting-mappings", () => {
  it("builds list + detail URLs", () => {
    expect(financeUrls.postingMappings()).toBe(
      "/api/v1/finance/posting-mappings"
    );
    expect(financeUrls.postingMapping("m1")).toBe(
      "/api/v1/finance/posting-mappings/m1"
    );
  });
});

describe("financeUrls — shared read-lookups owned by the foundation", () => {
  it("builds the profile GET URL (DoubleEntry mode guard)", () => {
    expect(financeUrls.profile()).toBe("/api/v1/finance/profile");
  });

  it("builds activity-areas FULL CRUD URLs (S6 imports as-is; S4 adds /report)", () => {
    expect(financeUrls.activityAreas()).toBe("/api/v1/finance/activity-areas");
    expect(financeUrls.activityArea("aa1")).toBe(
      "/api/v1/finance/activity-areas/aa1"
    );
  });

  it("builds the tax-codes + categories GET-list URLs", () => {
    expect(financeUrls.taxCodes()).toBe("/api/v1/finance/tax-codes");
    expect(financeUrls.categories()).toBe("/api/v1/finance/categories");
  });
});
