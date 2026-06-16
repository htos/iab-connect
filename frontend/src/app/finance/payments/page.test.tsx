// @vitest-environment jsdom
//
// E26-S1 (S3) characterization net — payments page (1167 lines; status x role matrix).
//
// A56 note: GUARD = inline "Not authorized" div. Reads role ONLY (canReadFinance); NO redirect,
//   NO return null — renders a centered "Not authorized" message. CONFIRMED.
// A79 deltas:
//   - HARDCODED-ENGLISH error strings (NOT i18n keys) — preserved verbatim, asserted as literal
//     English: "Failed to load open invoices", "Failed to load payments", "Failed to save payment",
//     "Failed to delete payment", "Failed to submit payment for approval", "Failed to approve payment",
//     "Failed to reject payment", "Failed to mark payment as paid", "Failed to attach receipt",
//     "Failed to detach receipt", "Failed to load receipt". Also hardcoded English UI labels:
//     "Edit", "Delete", "Not authorized", "Save", "Cancel", "Saving…", table headers
//     ("Invoice #", "Recipient", "Date", "Amount", "Reference", "Action", "Actions").
//   - Action affordance colours: submit = text-yellow-600, approve = text-blue-600,
//     reject = text-red-600, mark-paid = text-green-600, edit = text-orange-600,
//     delete = text-red-600. Pinned.
//   - Approve/Reject visible only when (isVorstand || isAdmin) AND status === "Submitted".
//   - IMMEDIATE no-confirm: Delete (status Draft) and receipt-detach fire with NO confirmation.
//     The ABSENCE of a confirm step is pinned.
//   - Reject IS a modal (two-step with reason). rejectReason.trim() is an ENABLE-guard only.
//   - Receipt attach = api.upload(file+notes) then POST /payments/{id}/receipt {receiptId};
//     receipt-detach = DELETE /payments/{id}/receipt. handlers DO inspect res.error here.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

// next/image passthrough (payments preview modal uses it).
vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt?: string; src?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  usePathname: () => "/finance/payments",
}));

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPut = vi.fn();
const apiDelete = vi.fn();
const apiUpload = vi.fn();
const authState = {
  isAuthenticated: true,
  isLoading: false,
  canReadFinance: true,
  canWriteFinance: true,
  isAdmin: true,
  isVorstand: true,
  isKassier: true,
  isAuditor: false,
  user: { name: "Kassier", email: "kassier@example.org" },
  accessToken: "tok",
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => ({
    get: apiGet,
    post: apiPost,
    put: apiPut,
    delete: apiDelete,
    upload: apiUpload,
  }),
}));

import Page from "./page";

function payment(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "pay-1",
    date: "2026-01-01T00:00:00Z",
    amount: 100,
    direction: "Expense",
    method: "Transfer",
    reference: "REF-1",
    notes: "",
    invoiceId: "",
    invoiceNumber: "R-001",
    transactionId: null,
    receiptId: null,
    status: "Draft",
    approvedBy: null,
    approvedAt: null,
    approvalComment: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    ...over,
  };
}

let paymentsFixture: ReturnType<typeof payment>[] = [];
const openInvoices = [
  {
    id: "inv-1",
    invoiceNumber: "R-001",
    recipientName: "Alice Acme",
    dueDate: "2026-02-01",
    total: 100,
    paidAmount: 0,
  },
];

function routeGet(url: string) {
  if (url === "/api/v1/finance/payments") {
    return Promise.resolve({
      data: { items: paymentsFixture },
      error: null,
      status: 200,
    });
  }
  if (url === "/api/v1/finance/invoices/open") {
    return Promise.resolve({ data: openInvoices, error: null, status: 200 });
  }
  if (url === "/api/v1/finance/receipts") {
    return Promise.resolve({ data: { items: [] }, error: null, status: 200 });
  }
  return Promise.resolve({ data: { items: [] }, error: null, status: 200 });
}

beforeEach(() => {
  paymentsFixture = [payment()];
  global.URL.createObjectURL = vi.fn(() => "blob:mock");
  global.URL.revokeObjectURL = vi.fn();
  apiGet.mockImplementation((url: string) => routeGet(url));
  apiPost.mockResolvedValue({ data: {}, error: null, status: 200 });
  apiPut.mockResolvedValue({ data: {}, error: null, status: 200 });
  apiDelete.mockResolvedValue({ data: null, error: null, status: 200 });
  apiUpload.mockResolvedValue({ data: {}, error: null, status: 200 });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  Object.assign(authState, {
    isAuthenticated: true,
    isLoading: false,
    canReadFinance: true,
    canWriteFinance: true,
    isAdmin: true,
    isVorstand: true,
    isKassier: true,
    isAuditor: false,
  });
});

// Helper: switch to the "all payments" tab where the action matrix lives.
async function gotoAllTab() {
  await waitFor(() =>
    expect(screen.getByText("allPayments")).toBeInTheDocument()
  );
  fireEvent.click(screen.getByText("allPayments"));
}

describe("payments — read guard (inline 'Not authorized', NO redirect)", () => {
  it("renders the literal 'Not authorized' div and fires no GET when !canReadFinance", async () => {
    authState.canReadFinance = false;
    render(<Page />);
    expect(screen.getByText("Not authorized")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(apiGet).not.toHaveBeenCalled();
  });
});

describe("payments — happy path + endpoints", () => {
  it("GETs open invoices and payments on load", async () => {
    render(<Page />);
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith("/api/v1/finance/invoices/open")
    );
    expect(apiGet).toHaveBeenCalledWith("/api/v1/finance/payments");
  });

  it("renders open-items rows in the default tab", async () => {
    render(<Page />);
    await waitFor(() =>
      expect(screen.getByText("Alice Acme")).toBeInTheDocument()
    );
    expect(screen.getByText("R-001")).toBeInTheDocument();
  });
});

describe("payments — hardcoded-English load errors (verbatim)", () => {
  it("shows 'Failed to load payments' (literal English, not an i18n key) when payments GET fails", async () => {
    apiGet.mockImplementation((url: string) => {
      if (url === "/api/v1/finance/payments") {
        return Promise.resolve({ data: null, error: "x", status: 500 });
      }
      return routeGet(url);
    });
    render(<Page />);
    await waitFor(() =>
      expect(screen.getByText("Failed to load payments")).toBeInTheDocument()
    );
  });

  it("shows 'Failed to load open invoices' when the open-invoices GET fails", async () => {
    apiGet.mockImplementation((url: string) => {
      if (url === "/api/v1/finance/invoices/open") {
        return Promise.resolve({ data: null, error: "x", status: 500 });
      }
      return routeGet(url);
    });
    render(<Page />);
    await waitFor(() =>
      expect(
        screen.getByText("Failed to load open invoices")
      ).toBeInTheDocument()
    );
  });
});

describe("payments — write-gating (Record)", () => {
  it("shows Record button when canWriteFinance, hidden for read-only", async () => {
    render(<Page />);
    await waitFor(() =>
      expect(screen.getByText("Alice Acme")).toBeInTheDocument()
    );
    expect(screen.getAllByText("recordPayment").length).toBeGreaterThan(0);
    cleanup();

    authState.canWriteFinance = false;
    render(<Page />);
    await waitFor(() =>
      expect(screen.getByText("Alice Acme")).toBeInTheDocument()
    );
    expect(screen.queryByText("recordPayment")).not.toBeInTheDocument();
  });
});

describe("payments — Draft row action matrix + affordance colours", () => {
  it("Draft+write shows Submit(yellow)/MarkPaid(green)/Edit(orange)/Delete(red)", async () => {
    render(<Page />);
    await gotoAllTab();
    await waitFor(() => expect(screen.getByText("submit")).toBeInTheDocument());

    expect(screen.getByText("submit").className).toContain("text-yellow-600");
    // markPaid appears in the Draft row AND quick-pay hint; assert the row one is green.
    const markPaidBtns = screen
      .getAllByText("markPaid")
      .filter((el) => el.className.includes("text-green-600"));
    expect(markPaidBtns.length).toBeGreaterThan(0);
    expect(screen.getByText("Edit").className).toContain("text-orange-600");
    expect(screen.getByText("Delete").className).toContain("text-red-600");
  });

  it("Submit POSTs /payments/{id}/submit and reloads", async () => {
    render(<Page />);
    await gotoAllTab();
    await waitFor(() => expect(screen.getByText("submit")).toBeInTheDocument());
    fireEvent.click(screen.getByText("submit"));
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/payments/pay-1/submit",
        {}
      )
    );
  });
});

describe("payments — Delete is IMMEDIATE (no confirmation)", () => {
  it("Delete DELETEs /payments/{id} directly with NO confirm modal", async () => {
    render(<Page />);
    await gotoAllTab();
    await waitFor(() => expect(screen.getByText("Delete")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Delete"));
    await waitFor(() =>
      expect(apiDelete).toHaveBeenCalledWith("/api/v1/finance/payments/pay-1")
    );
    // Pin the ABSENCE of a confirmation step (delete fired on the first click).
    expect(apiDelete).toHaveBeenCalledTimes(1);
  });
});

describe("payments — Submitted row: Approve/Reject gated on (isVorstand||isAdmin)", () => {
  beforeEach(() => {
    paymentsFixture = [payment({ id: "pay-2", status: "Submitted" })];
  });

  it("shows Approve(blue)/Reject(red) for a Vorstand/Admin", async () => {
    render(<Page />);
    await gotoAllTab();
    await waitFor(() =>
      expect(screen.getByText("approve")).toBeInTheDocument()
    );
    expect(screen.getByText("approve").className).toContain("text-blue-600");
    expect(screen.getByText("reject").className).toContain("text-red-600");
  });

  it("hides Approve/Reject when neither Vorstand nor Admin (kassier-only writer)", async () => {
    authState.isVorstand = false;
    authState.isAdmin = false;
    render(<Page />);
    await gotoAllTab();
    await waitFor(() =>
      expect(screen.getByText("allPayments")).toBeInTheDocument()
    );
    expect(screen.queryByText("approve")).not.toBeInTheDocument();
    expect(screen.queryByText("reject")).not.toBeInTheDocument();
  });

  it("Approve POSTs /payments/{id}/approve", async () => {
    render(<Page />);
    await gotoAllTab();
    await waitFor(() =>
      expect(screen.getByText("approve")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText("approve"));
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/payments/pay-2/approve",
        {}
      )
    );
  });

  it("Reject is a MODAL (two-step): opens reason modal, then POSTs /reject with the trimmed reason", async () => {
    render(<Page />);
    await gotoAllTab();
    await waitFor(() => expect(screen.getByText("reject")).toBeInTheDocument());
    fireEvent.click(screen.getByText("reject"));
    // Modal opened (rejectTitle); no POST yet.
    expect(screen.getByText("rejectTitle")).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalledWith(
      "/api/v1/finance/payments/pay-2/reject",
      expect.anything()
    );
    fireEvent.change(screen.getByPlaceholderText("reasonPlaceholder"), {
      target: { value: "bad" },
    });
    // The modal confirm 'reject' button is the one inside the modal.
    const rejectButtons = screen.getAllByText("reject");
    fireEvent.click(rejectButtons[rejectButtons.length - 1]);
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/payments/pay-2/reject",
        { reason: "bad" }
      )
    );
  });
});

describe("payments — Approved row: Mark-paid", () => {
  it("Approved+write POSTs /payments/{id}/mark-paid (green)", async () => {
    paymentsFixture = [payment({ id: "pay-3", status: "Approved" })];
    render(<Page />);
    await gotoAllTab();
    await waitFor(() =>
      expect(screen.getByText("markPaid")).toBeInTheDocument()
    );
    const markPaid = screen
      .getAllByText("markPaid")
      .find((el) => el.className.includes("text-green-600"))!;
    fireEvent.click(markPaid);
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/payments/pay-3/mark-paid",
        {}
      )
    );
  });
});

describe("payments — receipt detach is IMMEDIATE (no confirmation)", () => {
  it("detach DELETEs /payments/{id}/receipt directly with NO confirm", async () => {
    paymentsFixture = [
      payment({ id: "pay-4", status: "Paid", receiptId: "rec-1" }),
    ];
    render(<Page />);
    await gotoAllTab();
    await waitFor(() =>
      expect(screen.getByTitle("detachReceipt")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByTitle("detachReceipt"));
    await waitFor(() =>
      expect(apiDelete).toHaveBeenCalledWith(
        "/api/v1/finance/payments/pay-4/receipt"
      )
    );
    expect(apiDelete).toHaveBeenCalledTimes(1);
  });
});

describe("payments — receipt attach (upload + POST /receipt)", () => {
  it("uploads a new file (FormData file+notes) then POSTs /payments/{id}/receipt {receiptId}", async () => {
    apiUpload.mockResolvedValue({
      data: { id: "rec-new" },
      error: null,
      status: 200,
    });
    paymentsFixture = [
      payment({ id: "pay-5", status: "Draft", receiptId: null }),
    ];
    const { container } = render(<Page />);
    await gotoAllTab();
    await waitFor(() =>
      expect(screen.getByTitle("attachReceipt")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByTitle("attachReceipt"));

    const fileInput = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["x"], "r.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByText("uploadAndAttach"));
    await waitFor(() =>
      expect(apiUpload).toHaveBeenCalledWith(
        "/api/v1/finance/receipts",
        expect.any(FormData)
      )
    );
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/payments/pay-5/receipt",
        { receiptId: "rec-new" }
      )
    );
  });
});

describe("payments — create (Record modal)", () => {
  it("POSTs /payments with the form when Record is submitted", async () => {
    const { container } = render(<Page />);
    await waitFor(() =>
      expect(screen.getByText("Alice Acme")).toBeInTheDocument()
    );
    // Header Record button opens the modal with amount 0 -> set amount > 0 to enable submit.
    fireEvent.click(screen.getAllByText("recordPayment")[0]);
    // The "Amount (CHF)" label has no htmlFor — target the single number input in the modal.
    const amountInput = container.querySelector(
      'input[type="number"]'
    ) as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: "50" } });
    // Submit button label is recordPayment inside the modal.
    const submitBtns = screen.getAllByText("recordPayment");
    fireEvent.click(submitBtns[submitBtns.length - 1]);
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/payments",
        expect.objectContaining({ amount: 50 })
      )
    );
  });
});
