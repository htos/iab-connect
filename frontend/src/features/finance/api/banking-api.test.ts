import { describe, expect, it } from "vitest";
import { bankingKeys, bankingUrls } from "./banking-api";
import { FINANCE_BASE, financeKeys } from "./finance-api";
import type { TransactionFilters } from "../types/banking.types";

// E26-S5 focused api-shape tests: every banking/data URL is byte-identical to the three
// god-pages, the POST-vs-PUT `/ignore` divergence shares ONE path string, the exports
// journal query is string-interpolated, the transactions filters use URLSearchParams
// (bare URL when empty), and keys extend the shared finance namespace.

describe("bankingUrls — bank-imports", () => {
  it("builds the list + camt + detail URLs", () => {
    expect(bankingUrls.bankImports()).toBe("/api/v1/finance/bank-imports");
    expect(bankingUrls.bankImportsCamt()).toBe(
      "/api/v1/finance/bank-imports/camt"
    );
    expect(bankingUrls.bankImport("imp-1")).toBe(
      "/api/v1/finance/bank-imports/imp-1"
    );
  });

  it("shares ONE `/ignore` path string for BOTH POST (ignore) and PUT (unmatch)", () => {
    // The METHOD split lives in the hooks; the path is identical (pinned divergence).
    const ignorePath = bankingUrls.bankImportItemIgnore("imp-1", "item-9");
    expect(ignorePath).toBe(
      "/api/v1/finance/bank-imports/imp-1/items/item-9/ignore"
    );
  });

  it("builds the accept-match / reject-match / match item action sub-paths", () => {
    expect(bankingUrls.bankImportItemAcceptMatch("imp-1", "it-1")).toBe(
      "/api/v1/finance/bank-imports/imp-1/items/it-1/accept-match"
    );
    expect(bankingUrls.bankImportItemRejectMatch("imp-1", "it-1")).toBe(
      "/api/v1/finance/bank-imports/imp-1/items/it-1/reject-match"
    );
    expect(bankingUrls.bankImportItemMatch("imp-1", "it-1")).toBe(
      "/api/v1/finance/bank-imports/imp-1/items/it-1/match"
    );
  });
});

describe("bankingUrls — transactions (URLSearchParams server filters)", () => {
  const empty: TransactionFilters = {
    from: "",
    to: "",
    type: "",
    accountId: "",
    categoryId: "",
  };

  it("emits the BARE /transactions URL (no trailing ?) when no filter is set", () => {
    expect(bankingUrls.transactions(empty)).toBe(
      "/api/v1/finance/transactions"
    );
    expect(bankingUrls.transactions()).toBe("/api/v1/finance/transactions");
  });

  it("appends from/to/type/accountId/categoryId via URLSearchParams", () => {
    expect(bankingUrls.transactions({ ...empty, type: "Income" })).toBe(
      "/api/v1/finance/transactions?type=Income"
    );
    expect(
      bankingUrls.transactions({
        from: "2026-01-01",
        to: "2026-03-31",
        type: "Expense",
        accountId: "acc-1",
        categoryId: "cat-1",
      })
    ).toBe(
      "/api/v1/finance/transactions?from=2026-01-01&to=2026-03-31&type=Expense&accountId=acc-1&categoryId=cat-1"
    );
  });

  it("builds the per-id transaction + receipt-link URLs", () => {
    expect(bankingUrls.transaction("tx-1")).toBe(
      "/api/v1/finance/transactions/tx-1"
    );
    expect(bankingUrls.transactionReceipt("tx-1")).toBe(
      "/api/v1/finance/transactions/tx-1/receipt"
    );
  });
});

describe("bankingUrls — receipts (upload/info/download) + lookups", () => {
  it("builds the receipts list/info/download URLs", () => {
    expect(bankingUrls.receipts()).toBe("/api/v1/finance/receipts");
    expect(bankingUrls.receipt("r-1")).toBe("/api/v1/finance/receipts/r-1");
    expect(bankingUrls.receiptDownload("r-1")).toBe(
      "/api/v1/finance/receipts/r-1/download"
    );
  });

  it("builds the accounts/categories/activity-areas lookup URLs", () => {
    expect(bankingUrls.accounts()).toBe("/api/v1/finance/accounts");
    expect(bankingUrls.categories()).toBe("/api/v1/finance/categories");
    expect(bankingUrls.activityAreas()).toBe("/api/v1/finance/activity-areas");
  });
});

describe("bankingUrls — exports (string-interpolated journal query, no URLSearchParams)", () => {
  it("interpolates from/to directly into the journal URL", () => {
    expect(bankingUrls.exportsJournal("2026-01-01", "2026-03-31")).toBe(
      "/api/v1/finance/exports/journal?from=2026-01-01&to=2026-03-31"
    );
  });

  it("uses a fixed open-items URL with no query", () => {
    expect(bankingUrls.exportsOpenItems()).toBe(
      "/api/v1/finance/exports/open-items"
    );
  });
});

describe("bankingKeys — extend the shared finance namespace", () => {
  it("scopes every key under the finance root", () => {
    expect(bankingKeys.bankImports()[0]).toBe(financeKeys.all[0]);
    expect(bankingKeys.bankImports()).toEqual(["finance", "bank-imports"]);
    expect(bankingKeys.bankImport("imp-1")).toEqual([
      "finance",
      "bank-imports",
      "detail",
      "imp-1",
    ]);
    expect(bankingKeys.receipts()).toEqual(["finance", "receipts"]);
  });

  it("keys the transactions list on the filter object (server filters in the key)", () => {
    const filters: TransactionFilters = {
      from: "2026-01-01",
      to: "",
      type: "Income",
      accountId: "",
      categoryId: "",
    };
    const key = bankingKeys.transactions(filters);
    expect(key[0]).toBe("finance");
    expect(key[1]).toBe("transactions");
    expect(key[2]).toEqual(filters);
  });

  it("keeps FINANCE_BASE byte-identical to the foundation", () => {
    expect(FINANCE_BASE).toBe("/api/v1/finance");
  });
});
