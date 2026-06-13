import { describe, expect, it } from "vitest";

/**
 * E26-S3: the receivables/payables api owns its own URL builders + query keys on top
 * of the S2 foundation. These pin every `/api/v1/finance/{invoices,payments,receipts,
 * dunning,expense-claims}` URL (+ the non-finance `/api/v1/members` lookup) byte-
 * identically to the seven god-pages — INCLUDING the load-bearing two cancel-endpoint
 * divergence (list `DELETE /invoices/{id}` vs detail `POST /invoices/{id}/cancel`), the
 * blob endpoints (pdf, einvoice?format=ubl, receipt download), and the server filters.
 */

import {
  FINANCE_BASE,
  financeKeys,
  receivablesKeys,
  receivablesUrls,
} from "./receivables-api";

describe("receivables-api — re-exports the S2 foundation", () => {
  it("re-exports FINANCE_BASE and the financeKeys root", () => {
    expect(FINANCE_BASE).toBe("/api/v1/finance");
    expect(financeKeys.all).toEqual(["finance"]);
  });
});

describe("receivablesUrls — invoices (list filters + actions + blobs)", () => {
  it("builds the unfiltered list URL (no query)", () => {
    expect(receivablesUrls.invoices()).toBe("/api/v1/finance/invoices");
  });

  it("appends ?status=&from=&to= server filters in order", () => {
    expect(receivablesUrls.invoices("Draft")).toBe(
      "/api/v1/finance/invoices?status=Draft"
    );
    expect(receivablesUrls.invoices("Sent", "2026-01-01", "2026-12-31")).toBe(
      "/api/v1/finance/invoices?status=Sent&from=2026-01-01&to=2026-12-31"
    );
    expect(receivablesUrls.invoices("", "2026-01-01")).toBe(
      "/api/v1/finance/invoices?from=2026-01-01"
    );
  });

  it("builds open + detail + create + send", () => {
    expect(receivablesUrls.invoicesOpen()).toBe(
      "/api/v1/finance/invoices/open"
    );
    expect(receivablesUrls.invoice("inv-1")).toBe(
      "/api/v1/finance/invoices/inv-1"
    );
    expect(receivablesUrls.invoiceCreate()).toBe("/api/v1/finance/invoices");
    expect(receivablesUrls.invoiceSend("inv-1")).toBe(
      "/api/v1/finance/invoices/inv-1/send"
    );
  });

  it("pins the TWO cancel endpoints: list = DELETE /invoices/{id}, detail = POST /invoices/{id}/cancel", () => {
    // list cancel reuses the plain detail URL (DELETEd by the list hook)
    expect(receivablesUrls.invoice("inv-1")).toBe(
      "/api/v1/finance/invoices/inv-1"
    );
    // detail cancel = POST /cancel sub-path (the divergence)
    expect(receivablesUrls.invoiceCancel("inv-1")).toBe(
      "/api/v1/finance/invoices/inv-1/cancel"
    );
    expect(receivablesUrls.invoiceCancel("inv-1")).not.toBe(
      receivablesUrls.invoice("inv-1")
    );
  });

  it("builds the pdf + e-invoice (UBL) blob endpoints + invoiceId-scoped payments", () => {
    expect(receivablesUrls.invoicePdf("inv-1")).toBe(
      "/api/v1/finance/invoices/inv-1/pdf"
    );
    expect(receivablesUrls.invoiceEInvoice("inv-1")).toBe(
      "/api/v1/finance/invoices/inv-1/einvoice?format=ubl"
    );
    expect(receivablesUrls.invoicePayments("inv-1")).toBe(
      "/api/v1/finance/payments?invoiceId=inv-1"
    );
  });
});

describe("receivablesUrls — payments (CRUD + workflow + receipt)", () => {
  it("builds list + detail + workflow action sub-paths", () => {
    expect(receivablesUrls.payments()).toBe("/api/v1/finance/payments");
    expect(receivablesUrls.payment("p1")).toBe("/api/v1/finance/payments/p1");
    expect(receivablesUrls.paymentSubmit("p1")).toBe(
      "/api/v1/finance/payments/p1/submit"
    );
    expect(receivablesUrls.paymentApprove("p1")).toBe(
      "/api/v1/finance/payments/p1/approve"
    );
    expect(receivablesUrls.paymentReject("p1")).toBe(
      "/api/v1/finance/payments/p1/reject"
    );
    expect(receivablesUrls.paymentMarkPaid("p1")).toBe(
      "/api/v1/finance/payments/p1/mark-paid"
    );
    expect(receivablesUrls.paymentReceipt("p1")).toBe(
      "/api/v1/finance/payments/p1/receipt"
    );
  });
});

describe("receivablesUrls — receipts (list + download + detail)", () => {
  it("builds list + detail + download (blob)", () => {
    expect(receivablesUrls.receipts()).toBe("/api/v1/finance/receipts");
    expect(receivablesUrls.receipt("r1")).toBe("/api/v1/finance/receipts/r1");
    expect(receivablesUrls.receiptDownload("r1")).toBe(
      "/api/v1/finance/receipts/r1/download"
    );
  });
});

describe("receivablesUrls — dunning + expense-claims + members lookup", () => {
  it("builds dunning list + send", () => {
    expect(receivablesUrls.dunning()).toBe("/api/v1/finance/dunning");
    expect(receivablesUrls.dunningSend("d1")).toBe(
      "/api/v1/finance/dunning/d1/send"
    );
  });

  it("builds expense-claims list with ?status=&myClaimsOnly= server filters", () => {
    expect(receivablesUrls.expenseClaims()).toBe(
      "/api/v1/finance/expense-claims"
    );
    expect(receivablesUrls.expenseClaims("all")).toBe(
      "/api/v1/finance/expense-claims"
    );
    expect(receivablesUrls.expenseClaims("Approved")).toBe(
      "/api/v1/finance/expense-claims?status=Approved"
    );
    expect(receivablesUrls.expenseClaims("Approved", true)).toBe(
      "/api/v1/finance/expense-claims?status=Approved&myClaimsOnly=true"
    );
    expect(receivablesUrls.expenseClaims("all", true)).toBe(
      "/api/v1/finance/expense-claims?myClaimsOnly=true"
    );
  });

  it("builds expense-claim workflow action sub-paths", () => {
    expect(receivablesUrls.expenseClaim("c1")).toBe(
      "/api/v1/finance/expense-claims/c1"
    );
    expect(receivablesUrls.expenseClaimSubmit("c1")).toBe(
      "/api/v1/finance/expense-claims/c1/submit"
    );
    expect(receivablesUrls.expenseClaimReview("c1")).toBe(
      "/api/v1/finance/expense-claims/c1/review"
    );
    expect(receivablesUrls.expenseClaimApprove("c1")).toBe(
      "/api/v1/finance/expense-claims/c1/approve"
    );
    expect(receivablesUrls.expenseClaimReject("c1")).toBe(
      "/api/v1/finance/expense-claims/c1/reject"
    );
    expect(receivablesUrls.expenseClaimReimburse("c1")).toBe(
      "/api/v1/finance/expense-claims/c1/reimburse"
    );
  });

  it("builds the non-finance members lookup (pageSize=500)", () => {
    expect(receivablesUrls.members()).toBe("/api/v1/members?pageSize=500");
  });

  it("re-exposes the shared finance read-lookups", () => {
    expect(receivablesUrls.taxCodes()).toBe("/api/v1/finance/tax-codes");
    expect(receivablesUrls.activityAreas()).toBe(
      "/api/v1/finance/activity-areas"
    );
  });
});

describe("receivablesKeys — namespaced under the finance root", () => {
  it("keys each resource under ['finance', ...]", () => {
    expect(receivablesKeys.invoices("Draft", "", "")).toEqual([
      "finance",
      "invoices",
      "list",
      { status: "Draft", from: "", to: "" },
    ]);
    expect(receivablesKeys.invoicesOpen()).toEqual([
      "finance",
      "invoices",
      "open",
    ]);
    expect(receivablesKeys.invoice("i1")).toEqual([
      "finance",
      "invoices",
      "detail",
      "i1",
    ]);
    expect(receivablesKeys.invoicePayments("i1")).toEqual([
      "finance",
      "invoices",
      "detail",
      "i1",
      "payments",
    ]);
    expect(receivablesKeys.payments()).toEqual(["finance", "payments"]);
    expect(receivablesKeys.receipts()).toEqual(["finance", "receipts"]);
    expect(receivablesKeys.dunning()).toEqual(["finance", "dunning"]);
    expect(receivablesKeys.expenseClaims("Approved", true)).toEqual([
      "finance",
      "expense-claims",
      "list",
      { status: "Approved", myClaimsOnly: true },
    ]);
  });
});
