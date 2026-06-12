// @vitest-environment jsdom
//
// E26-S1 (S3) characterization net — expense-claims page (915 lines; ownership predicates).
//
// A56 note: GUARD = inline "Not authorized" div. Reads role ONLY (canReadFinance); NO redirect,
//   NO return null. CONFIRMED.
// A79 deltas:
//   - Per-claim ownership+role predicates (pinned verbatim):
//       edit/submit/delete  : status==="Draft" && (claimantId === user?.email || isAdmin)
//       review              : status==="Submitted"   && (isKassier || isAdmin)
//       approve             : status==="UnderReview"  && (isVorstand || isAdmin)
//       reject              : status in {Submitted,UnderReview} && (isKassier||isVorstand||isAdmin)
//       reimburse           : status==="Approved"     && (isKassier || isAdmin)
//   - A95: currency <select> = CHF | EUR (formatAmount uses Intl currency). Round-trip pinned.
//   - Server filters: status + myClaimsOnly appended as query params; search is client-side.
//   - All actions go through a confirm modal (two-step). reject reason .trim() is enable-guard only.
//   - Action button colours in the confirm modal: delete/reject = bg-red-600, approve = bg-green-600,
//     reimburse = bg-emerald-600, else bg-orange-600. Pinned.
//   - Errors/success use i18n keys ("error"/"success"). Not authorized = literal English.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  usePathname: () => "/finance/expense-claims",
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

function claim(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "c-1",
    title: "Taxi",
    description: "Airport taxi",
    amount: 42,
    currency: "CHF",
    date: "2026-01-01T00:00:00Z",
    status: "Draft",
    claimantId: "kassier@example.org",
    claimantName: "Kassier",
    receiptId: null,
    reviewedBy: null,
    reviewedAt: null,
    reviewComment: null,
    approvedBy: null,
    approvedAt: null,
    approvalComment: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    paymentId: null,
    reimbursedAt: null,
    reimbursedBy: null,
    createdAt: "2026-01-01T00:00:00Z",
    createdBy: "Kassier",
    ...over,
  };
}

let claimsFixture: ReturnType<typeof claim>[] = [];

function routeGet(url: string) {
  if (url.startsWith("/api/v1/finance/expense-claims")) {
    return Promise.resolve({
      data: { items: claimsFixture },
      error: null,
      status: 200,
    });
  }
  return Promise.resolve({ data: { items: [] }, error: null, status: 200 });
}

beforeEach(() => {
  claimsFixture = [claim()];
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
    user: { name: "Kassier", email: "kassier@example.org" },
  });
});

describe("expense-claims — read guard (inline 'Not authorized', NO redirect)", () => {
  it("renders the literal 'Not authorized' div and fires no GET when !canReadFinance", async () => {
    authState.canReadFinance = false;
    render(<Page />);
    expect(screen.getByText("Not authorized")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(apiGet).not.toHaveBeenCalled();
  });
});

describe("expense-claims — happy path + endpoint", () => {
  it("GETs /api/v1/finance/expense-claims (no query, default filters) and renders rows", async () => {
    render(<Page />);
    await waitFor(() => expect(screen.getByText("Taxi")).toBeInTheDocument());
    expect(apiGet).toHaveBeenCalledWith("/api/v1/finance/expense-claims");
  });

  it("appends status + myClaimsOnly query params when filtered", async () => {
    render(<Page />);
    await waitFor(() => expect(screen.getByText("Taxi")).toBeInTheDocument());
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Approved" },
    });
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith(
        "/api/v1/finance/expense-claims?status=Approved"
      )
    );
    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith(
        "/api/v1/finance/expense-claims?status=Approved&myClaimsOnly=true"
      )
    );
  });

  it("renders the empty state when there are no claims", async () => {
    apiGet.mockResolvedValue({ data: { items: [] }, error: null, status: 200 });
    render(<Page />);
    await waitFor(() =>
      expect(screen.getByText("noClaimsTitle")).toBeInTheDocument()
    );
  });
});

describe("expense-claims — write-gating (Create)", () => {
  it("shows Create when canWriteFinance, hidden for read-only", async () => {
    render(<Page />);
    await waitFor(() => expect(screen.getByText("Taxi")).toBeInTheDocument());
    expect(screen.getByText("create")).toBeInTheDocument();
    cleanup();

    authState.canWriteFinance = false;
    render(<Page />);
    await waitFor(() => expect(screen.getByText("Taxi")).toBeInTheDocument());
    expect(screen.queryByText("create")).not.toBeInTheDocument();
  });
});

describe("expense-claims — ownership predicate on Draft (edit/submit/delete)", () => {
  it("shows edit/submit/delete on a Draft owned by the current user", async () => {
    render(<Page />);
    await waitFor(() => expect(screen.getByText("Taxi")).toBeInTheDocument());
    const row = screen.getByText("Taxi").closest("tr")!;
    expect(within(row).getByText("edit")).toBeInTheDocument();
    expect(within(row).getByText("submit")).toBeInTheDocument();
    expect(within(row).getByText("delete")).toBeInTheDocument();
  });

  it("hides edit/submit/delete on a Draft owned by SOMEONE ELSE when not admin", async () => {
    authState.isAdmin = false;
    claimsFixture = [
      claim({
        id: "c-2",
        claimantId: "other@example.org",
        claimantName: "Other",
      }),
    ];
    render(<Page />);
    await waitFor(() => expect(screen.getByText("Taxi")).toBeInTheDocument());
    const row = screen.getByText("Taxi").closest("tr")!;
    expect(within(row).queryByText("edit")).not.toBeInTheDocument();
    expect(within(row).queryByText("submit")).not.toBeInTheDocument();
    expect(within(row).queryByText("delete")).not.toBeInTheDocument();
  });

  it("an admin sees edit/submit/delete on someone else's Draft (isAdmin override)", async () => {
    claimsFixture = [
      claim({
        id: "c-3",
        claimantId: "other@example.org",
        claimantName: "Other",
      }),
    ];
    render(<Page />);
    await waitFor(() => expect(screen.getByText("Taxi")).toBeInTheDocument());
    const row = screen.getByText("Taxi").closest("tr")!;
    expect(within(row).getByText("edit")).toBeInTheDocument();
  });
});

describe("expense-claims — review/approve/reject/reimburse role predicates", () => {
  it("Submitted shows review (kassier/admin) + reject; NOT approve/reimburse", async () => {
    claimsFixture = [claim({ id: "c-s", status: "Submitted" })];
    render(<Page />);
    await waitFor(() => expect(screen.getByText("Taxi")).toBeInTheDocument());
    const row = screen.getByText("Taxi").closest("tr")!;
    expect(within(row).getByText("review")).toBeInTheDocument();
    expect(within(row).getByText("reject")).toBeInTheDocument();
    expect(within(row).queryByText("approve")).not.toBeInTheDocument();
    expect(within(row).queryByText("reimburse")).not.toBeInTheDocument();
  });

  it("UnderReview shows approve (vorstand/admin) + reject; NOT review", async () => {
    claimsFixture = [claim({ id: "c-u", status: "UnderReview" })];
    render(<Page />);
    await waitFor(() => expect(screen.getByText("Taxi")).toBeInTheDocument());
    const row = screen.getByText("Taxi").closest("tr")!;
    expect(within(row).getByText("approve")).toBeInTheDocument();
    expect(within(row).getByText("reject")).toBeInTheDocument();
    expect(within(row).queryByText("review")).not.toBeInTheDocument();
  });

  it("Approved shows reimburse (kassier/admin) only", async () => {
    claimsFixture = [claim({ id: "c-a", status: "Approved" })];
    render(<Page />);
    await waitFor(() => expect(screen.getByText("Taxi")).toBeInTheDocument());
    const row = screen.getByText("Taxi").closest("tr")!;
    expect(within(row).getByText("reimburse")).toBeInTheDocument();
    expect(within(row).queryByText("approve")).not.toBeInTheDocument();
  });

  it("a kassier-only (no vorstand/admin) does NOT see approve on UnderReview", async () => {
    authState.isVorstand = false;
    authState.isAdmin = false;
    claimsFixture = [claim({ id: "c-u2", status: "UnderReview" })];
    render(<Page />);
    await waitFor(() => expect(screen.getByText("Taxi")).toBeInTheDocument());
    const row = screen.getByText("Taxi").closest("tr")!;
    expect(within(row).queryByText("approve")).not.toBeInTheDocument();
    // But reject IS available to kassier on UnderReview.
    expect(within(row).getByText("reject")).toBeInTheDocument();
  });
});

describe("expense-claims — workflow actions POST the right endpoints (via confirm modal)", () => {
  it("submit -> POST /expense-claims/{id}/submit", async () => {
    render(<Page />);
    await waitFor(() => expect(screen.getByText("Taxi")).toBeInTheDocument());
    const row = screen.getByText("Taxi").closest("tr")!;
    fireEvent.click(within(row).getByText("submit"));
    // Action confirm modal; no POST yet.
    expect(apiPost).not.toHaveBeenCalled();
    // The modal confirm button label is "submit"; click the last one.
    const submitButtons = screen.getAllByText("submit");
    fireEvent.click(submitButtons[submitButtons.length - 1]);
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/expense-claims/c-1/submit",
        {}
      )
    );
  });

  it("reject confirm button is red and POSTs /reject with the reason", async () => {
    claimsFixture = [claim({ id: "c-rej", status: "Submitted" })];
    render(<Page />);
    await waitFor(() => expect(screen.getByText("Taxi")).toBeInTheDocument());
    const row = screen.getByText("Taxi").closest("tr")!;
    fireEvent.click(within(row).getByText("reject"));
    fireEvent.change(screen.getByPlaceholderText("reasonPlaceholder"), {
      target: { value: "no good" },
    });
    const rejectButtons = screen.getAllByText("reject");
    const confirmBtn = rejectButtons.find((el) =>
      el.className.includes("bg-red-600")
    )!;
    fireEvent.click(confirmBtn);
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/expense-claims/c-rej/reject",
        { reason: "no good" }
      )
    );
  });

  it("delete -> DELETE /expense-claims/{id} (confirm modal, red button)", async () => {
    render(<Page />);
    await waitFor(() => expect(screen.getByText("Taxi")).toBeInTheDocument());
    const row = screen.getByText("Taxi").closest("tr")!;
    fireEvent.click(within(row).getByText("delete"));
    expect(screen.getByText("deleteConfirm")).toBeInTheDocument();
    const deleteButtons = screen.getAllByText("delete");
    const confirmBtn = deleteButtons.find((el) =>
      el.className.includes("bg-red-600")
    )!;
    fireEvent.click(confirmBtn);
    await waitFor(() =>
      expect(apiDelete).toHaveBeenCalledWith(
        "/api/v1/finance/expense-claims/c-1"
      )
    );
  });
});

describe("expense-claims — create form (A95 currency round-trip)", () => {
  it("POSTs /expense-claims with currency round-tripped from the CHF/EUR select", async () => {
    render(<Page />);
    await waitFor(() => expect(screen.getByText("Taxi")).toBeInTheDocument());
    fireEvent.click(screen.getByText("create"));

    fireEvent.change(screen.getByPlaceholderText("titlePlaceholder"), {
      target: { value: "Train" },
    });
    fireEvent.change(screen.getByPlaceholderText("amountPlaceholder"), {
      target: { value: "33" },
    });
    fireEvent.change(screen.getByDisplayValue("CHF"), {
      target: { value: "EUR" },
    });

    // Submit button label is "create" inside the modal.
    const createButtons = screen.getAllByText("create");
    fireEvent.click(createButtons[createButtons.length - 1]);
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/expense-claims",
        expect.objectContaining({ currency: "EUR", title: "Train" })
      )
    );
  });
});

describe("expense-claims — error banner", () => {
  it("shows the 'error' key when the GET fails", async () => {
    apiGet.mockResolvedValue({ data: null, error: "x", status: 500 });
    render(<Page />);
    await waitFor(() => expect(screen.getByText("error")).toBeInTheDocument());
  });
});
