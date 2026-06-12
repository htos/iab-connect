// @vitest-environment jsdom
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

// ============================================================================
// E26-S1 (S5 banking/data) — bank-import characterization net.
//
// Guard variant CONFIRMED: INLINE "Not authorized" div — reads role ONLY
//   (canReadFinance/canWriteFinance), NO router redirect, NO `return null`.
//   On !canReadFinance it renders a centered "Not authorized" <div> and the
//   data-load effect is gated behind `if (canReadFinance)` so NO GET fires.
//
// AC-6 upload/download pins owned here:
//   - upload: api.upload("/api/v1/finance/bank-imports", FormData{file})  (CSV/mt940)
//   - upload: api.upload("/api/v1/finance/bank-imports/camt", FormData{file})  (camt XML)
//   - POST-vs-PUT /ignore divergence: handleIgnore = POST .../items/{id}/ignore,
//     handleUnmatch = PUT .../items/{id}/ignore  (SAME path, DIFFERENT method).
//
// A79 deltas: ALL transport via useApiClient direct (BUILD-on-useApiClient,
//   mock survives slice migration with ZERO edits). No raw fetch, no lib module.
// A56 notes: hardcoded-English error strings ("Failed to upload file", etc.)
//   pinned verbatim — do NOT translate. Inline guard div text "Not authorized"
//   is a literal English string (NOT an i18n key) — pinned AS-IS.
// A96: no submitted bytes trimmed (searchTerm.trim() is a client filter guard only).
// ============================================================================

// next-intl: STABLE identity translator (A64/A78 — defined ONCE).
vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  usePathname: () => "/finance/bank-import",
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href?: string;
  }) => <a href={typeof href === "string" ? href : "#"}>{children}</a>,
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

import BankImportPage from "./page";

// --- Fixtures -------------------------------------------------------------

const IMPORT_ROW = {
  id: "imp-1",
  importDate: "2026-06-01T00:00:00Z",
  fileName: "statement-june.csv",
  status: "Processed",
  itemCount: 3,
};

const UNMATCHED_ITEM = {
  id: "item-unmatched",
  transactionDate: "2026-06-02T00:00:00Z",
  description: "Membership fee",
  amount: 120,
  iban: "CH9300762011623852957",
  reference: "RF18",
  status: "Unmatched" as const,
  paymentId: null,
  endToEndId: "E2E-1",
  creditorReference: "CR-1",
  remittanceInfo: "Membership fee",
  debtorName: "Jane Doe",
  debtorIban: "CH56",
  suggestedInvoiceId: "inv-99",
  matchConfidence: 0.92,
};

const IGNORED_ITEM = {
  ...UNMATCHED_ITEM,
  id: "item-ignored",
  description: "Old line",
  status: "Ignored" as const,
  suggestedInvoiceId: null,
  matchConfidence: null,
  paymentId: null,
};

const IMPORT_DETAIL = {
  ...IMPORT_ROW,
  items: [UNMATCHED_ITEM, IGNORED_ITEM],
};

function routeGet(url: string) {
  if (url === "/api/v1/finance/bank-imports") {
    return Promise.resolve({
      data: { items: [IMPORT_ROW] },
      error: null,
      status: 200,
    });
  }
  if (url.startsWith("/api/v1/finance/bank-imports/")) {
    return Promise.resolve({ data: IMPORT_DETAIL, error: null, status: 200 });
  }
  return Promise.resolve({ data: { items: [] }, error: null, status: 200 });
}

beforeEach(() => {
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

// Open the detail view so item-level actions render.
async function openDetail() {
  await waitFor(() => {
    expect(screen.getByText("viewItems")).toBeInTheDocument();
  });
  fireEvent.click(screen.getByText("viewItems"));
  // Detail view is open once a detail-only column header renders. "Membership fee"
  // appears twice (Unmatched description + Ignored remittanceInfo) and the action
  // buttons are write-gated, so wait on a non-write-gated detail-only label.
  await waitFor(() => {
    expect(screen.getByText("matchSuggestion")).toBeInTheDocument();
  });
}

describe("bank-import — read guard (AC-2: INLINE 'Not authorized' div, no redirect)", () => {
  it("renders an inline 'Not authorized' div and fires NO GET when !canReadFinance", async () => {
    authState.canReadFinance = false;
    render(<BankImportPage />);

    expect(screen.getByText("Not authorized")).toBeInTheDocument();
    // No redirect of any kind (pin the absence — this is NOT the canonical shape).
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    // Data-load effect is gated behind canReadFinance → no bank-imports GET.
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("loads the import history (GET /bank-imports) for a read user", async () => {
    render(<BankImportPage />);

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith("/api/v1/finance/bank-imports");
    });
    // A79 data-mechanism accommodation (NOT a transport-mock edit): the slice's TanStack
    // list query commits the resolved data on a follow-up render, one tick after the
    // `apiGet` call is observed (the god-page fetched + setState in one awaited pass).
    // Behaviour preserved: the history row + heading render after the load resolves.
    await waitFor(() => {
      expect(screen.getByText("statement-june.csv")).toBeInTheDocument();
    });
    expect(screen.getByText("importHistory")).toBeInTheDocument();
  });
});

describe("bank-import — write guard (AC-3: upload section gated on canWriteFinance)", () => {
  it("shows the upload section when canWriteFinance", async () => {
    render(<BankImportPage />);
    await waitFor(() => {
      expect(screen.getByText("uploadFile")).toBeInTheDocument();
    });
    expect(screen.getByText("upload")).toBeInTheDocument();
    expect(screen.getByText("importCamt")).toBeInTheDocument();
  });

  it("hides the upload section for a read-only user", async () => {
    authState.canWriteFinance = false;
    render(<BankImportPage />);
    await waitFor(() => {
      expect(screen.getByText("importHistory")).toBeInTheDocument();
    });
    expect(screen.queryByText("uploadFile")).not.toBeInTheDocument();
    expect(screen.queryByText("upload")).not.toBeInTheDocument();
  });

  it("hides item-level match/ignore actions for a read-only user", async () => {
    authState.canWriteFinance = false;
    render(<BankImportPage />);
    await openDetail();

    // Unmatched-row match/ignore + suggested accept/reject are write-gated.
    expect(screen.queryByText("match")).not.toBeInTheDocument();
    expect(screen.queryByText("ignore")).not.toBeInTheDocument();
    expect(screen.queryByText("acceptMatch")).not.toBeInTheDocument();
    expect(screen.queryByText("rejectMatch")).not.toBeInTheDocument();
    expect(screen.queryByText("unmatch")).not.toBeInTheDocument();
  });
});

describe("bank-import — AC-6 UPLOAD (FormData field 'file', Content-Type omitted)", () => {
  it("uploads a CSV/mt940 to POST /bank-imports with FormData field 'file'", async () => {
    const { container } = render(<BankImportPage />);
    await waitFor(() => {
      expect(screen.getByText("uploadFile")).toBeInTheDocument();
    });

    const fileInput = container.querySelector(
      'input[accept=".csv,.mt940,.camt"]'
    ) as HTMLInputElement;
    const file = new File(["a,b\n1,2"], "statement.csv", { type: "text/csv" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByText("upload"));

    await waitFor(() => {
      expect(apiUpload).toHaveBeenCalledWith(
        "/api/v1/finance/bank-imports",
        expect.any(FormData)
      );
    });
    // Pin the EXACT FormData field name + that it carries the File (no JSON mutation).
    const fd = apiUpload.mock.calls[0][1] as FormData;
    expect(fd.get("file")).toBe(file);
    expect(fd.get("notes")).toBeNull();
  });

  it("imports a camt XML to POST /bank-imports/camt with FormData field 'file'", async () => {
    const { container } = render(<BankImportPage />);
    await waitFor(() => {
      expect(screen.getByText("importCamt")).toBeInTheDocument();
    });

    const camtInput = container.querySelector(
      'input[accept=".xml"]'
    ) as HTMLInputElement;
    const file = new File(["<Document/>"], "camt.xml", {
      type: "application/xml",
    });
    // camt upload fires immediately on change (no button click).
    fireEvent.change(camtInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(apiUpload).toHaveBeenCalledWith(
        "/api/v1/finance/bank-imports/camt",
        expect.any(FormData)
      );
    });
    const fd = apiUpload.mock.calls[0][1] as FormData;
    expect(fd.get("file")).toBe(file);
  });

  it("re-fetches the import history after a successful upload", async () => {
    const { container } = render(<BankImportPage />);
    await waitFor(() => {
      expect(screen.getByText("uploadFile")).toBeInTheDocument();
    });
    apiGet.mockClear();

    const fileInput = container.querySelector(
      'input[accept=".csv,.mt940,.camt"]'
    ) as HTMLInputElement;
    const file = new File(["x"], "s.csv", { type: "text/csv" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByText("upload"));

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith("/api/v1/finance/bank-imports");
    });
  });

  it("A56: surfaces the hardcoded-English error on upload failure (NOT an i18n key)", async () => {
    apiUpload.mockRejectedValue(new Error("network"));
    const { container } = render(<BankImportPage />);
    await waitFor(() => {
      expect(screen.getByText("uploadFile")).toBeInTheDocument();
    });

    const fileInput = container.querySelector(
      'input[accept=".csv,.mt940,.camt"]'
    ) as HTMLInputElement;
    const file = new File(["x"], "s.csv", { type: "text/csv" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByText("upload"));

    // Literal English string from the catch block — pinned verbatim.
    await waitFor(() => {
      expect(screen.getByText("Failed to upload file")).toBeInTheDocument();
    });
  });
});

describe("bank-import — AC-6 POST-vs-PUT /ignore divergence (same path, different method)", () => {
  it("handleIgnore POSTs to .../items/{id}/ignore (Unmatched row 'ignore')", async () => {
    render(<BankImportPage />);
    await openDetail();

    // Ignore the Unmatched item.
    fireEvent.click(screen.getByText("ignore"));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/bank-imports/imp-1/items/item-unmatched/ignore",
        {}
      );
    });
    // Must NOT use PUT for the ignore action.
    expect(apiPut).not.toHaveBeenCalledWith(
      "/api/v1/finance/bank-imports/imp-1/items/item-unmatched/ignore",
      expect.anything()
    );
  });

  it("handleUnmatch PUTs to .../items/{id}/ignore (Ignored row 'unmatch')", async () => {
    render(<BankImportPage />);
    await openDetail();

    // Unmatch the Ignored item — same /ignore path, but PUT.
    fireEvent.click(screen.getByText("unmatch"));

    await waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith(
        "/api/v1/finance/bank-imports/imp-1/items/item-ignored/ignore",
        {}
      );
    });
    expect(apiPost).not.toHaveBeenCalledWith(
      "/api/v1/finance/bank-imports/imp-1/items/item-ignored/ignore",
      expect.anything()
    );
  });
});

describe("bank-import — AC-5 match affordances (accept=green / reject=red)", () => {
  it("accept-match PUTs .../accept-match with the suggested invoiceId; button is green", async () => {
    render(<BankImportPage />);
    await openDetail();

    const acceptBtn = screen.getByText("acceptMatch");
    // A86: accept affordance ships green.
    expect(acceptBtn.className).toContain("text-green-700");
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith(
        "/api/v1/finance/bank-imports/imp-1/items/item-unmatched/accept-match",
        { invoiceId: "inv-99" }
      );
    });
  });

  it("reject-match PUTs .../reject-match; button is red", async () => {
    render(<BankImportPage />);
    await openDetail();

    const rejectBtn = screen.getByText("rejectMatch");
    expect(rejectBtn.className).toContain("text-red-700");
    fireEvent.click(rejectBtn);

    await waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith(
        "/api/v1/finance/bank-imports/imp-1/items/item-unmatched/reject-match",
        {}
      );
    });
  });

  it("manual match PUTs .../match with the entered paymentId", async () => {
    render(<BankImportPage />);
    await openDetail();

    // Open the match modal via the row's "match" action.
    fireEvent.click(screen.getByText("match"));
    const modal = await screen.findByText("Payment ID");
    const dialog = modal.closest("div.fixed") as HTMLElement;
    const input = within(dialog).getByPlaceholderText(
      "Enter existing payment ID or leave blank to create new"
    );
    fireEvent.change(input, { target: { value: "pay-7" } });

    // The modal's submit button is the last "match" label.
    const matchButtons = within(dialog).getAllByText("match");
    fireEvent.click(matchButtons[matchButtons.length - 1]);

    await waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith(
        "/api/v1/finance/bank-imports/imp-1/items/item-unmatched/match",
        { paymentId: "pay-7" }
      );
    });
  });
});
