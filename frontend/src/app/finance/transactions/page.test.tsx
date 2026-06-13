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
// E26-S1 (S5 banking/data) — transactions characterization net (largest finance page).
//
// Guard variant CONFIRMED: CANONICAL.
//   - reads isAuthenticated + isLoading(authLoading) + canReadFinance + canWriteFinance.
//   - effect: `if (!authLoading && (!isAuthenticated || !canReadFinance)) router.push("/")`.
//   - render: spinner while `authLoading || (loading && transactions.length===0)`,
//             then `if (!isAuthenticated || !canReadFinance) return null`.
//   - redirect TARGET = "/", via router.push (NOT replace).
//
// AC-6 upload/download pins owned here:
//   - receipt UPLOAD: api.upload("/api/v1/finance/receipts", FormData{file, notes})
//     (field "file" AND "notes"). Then POST .../transactions/{id}/receipt {receiptId}.
//   - receipt DOWNLOAD/PREVIEW: GET .../receipts/{id} (info) → GET .../receipts/{id}/download
//     (blob) → URL.createObjectURL.
//       * image/* OR application/pdf  → PREVIEW MODAL (deferred revoke on close).
//       * otherwise                   → anchor download=<fileName||"receipt">,
//                                       APPENDED to body + click + REMOVED + immediate revoke.
//     (Contrast exports: that anchor is NOT appended. Pinned both ways.)
//
// Server filters: GET /transactions?from&to&type&accountId&categoryId built with URLSearchParams.
// AC-5: delete-confirm modal button = red (bg-red-600). detach receipt = immediate (no confirm).
// A79: useApiClient direct (BUILD; mock survives migration). A96: handleSubmit DOES .trim()
//   description/reference/notes — pinned AS-IS (S6 RHF+Zod migration must NOT regress, but A96
//   warns the canonical guidance is "no new .trim()"; this page's existing .trim() is preserved).
// ============================================================================

vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  usePathname: () => "/finance/transactions",
}));

// next/image passthrough (the PDF/image preview modal renders next/image).
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
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

import TransactionsPage from "./page";

// --- Fixtures -------------------------------------------------------------

const TX_NO_RECEIPT = {
  id: "tx-1",
  date: "2026-06-01T00:00:00Z",
  description: "Office supplies",
  amount: 42.5,
  type: "Expense" as const,
  accountId: "acc-1",
  accountName: "Main",
  categoryId: "cat-1",
  categoryName: "Supplies",
  receiptId: null,
  reference: "REF1",
  notes: "",
  activityAreaId: null,
  activityAreaName: null,
  activityAreaCode: null,
};

const TX_WITH_RECEIPT = {
  ...TX_NO_RECEIPT,
  id: "tx-2",
  description: "Hotel",
  type: "Income" as const,
  receiptId: "rcpt-9",
};

const ACCOUNTS = [{ id: "acc-1", name: "Main" }];
const CATEGORIES = [{ id: "cat-1", name: "Supplies", type: "Expense" }];
const ACTIVITY_AREAS = [
  { id: "aa-1", name: "Events", code: "EVT", isActive: true, sortOrder: 0 },
];
const RECEIPTS = [
  {
    id: "rcpt-1",
    fileName: "scan.pdf",
    contentType: "application/pdf",
    fileSize: 100,
    notes: "",
    createdAt: "2026-06-01T00:00:00Z",
  },
];

function routeGet(url: string) {
  if (url === "/api/v1/finance/accounts") {
    return Promise.resolve({
      data: { items: ACCOUNTS },
      error: null,
      status: 200,
    });
  }
  if (url === "/api/v1/finance/categories") {
    return Promise.resolve({
      data: { items: CATEGORIES },
      error: null,
      status: 200,
    });
  }
  if (url === "/api/v1/finance/activity-areas") {
    return Promise.resolve({
      data: { items: ACTIVITY_AREAS },
      error: null,
      status: 200,
    });
  }
  if (url === "/api/v1/finance/receipts") {
    return Promise.resolve({
      data: { items: RECEIPTS },
      error: null,
      status: 200,
    });
  }
  if (url.startsWith("/api/v1/finance/transactions")) {
    return Promise.resolve({
      data: { items: [TX_NO_RECEIPT, TX_WITH_RECEIPT] },
      error: null,
      status: 200,
    });
  }
  return Promise.resolve({ data: { items: [] }, error: null, status: 200 });
}

beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => "blob:mock");
  global.URL.revokeObjectURL = vi.fn();
  apiGet.mockImplementation((url: string) => routeGet(url));
  apiPost.mockResolvedValue({ data: {}, error: null, status: 200 });
  apiPut.mockResolvedValue({ data: {}, error: null, status: 200 });
  apiDelete.mockResolvedValue({ data: null, error: null, status: 200 });
  apiUpload.mockResolvedValue({
    data: { id: "rcpt-new" },
    error: null,
    status: 200,
  });
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

async function renderLoaded() {
  const utils = render(<TransactionsPage />);
  await waitFor(() => {
    expect(screen.getByText("Office supplies")).toBeInTheDocument();
  });
  return utils;
}

describe("transactions — read guard (AC-2: CANONICAL, push('/'), spinner→null)", () => {
  it("pushes '/' when authenticated but !canReadFinance, and fires NO transactions GET", async () => {
    authState.canReadFinance = false;
    render(<TransactionsPage />);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/");
    });
    // Reference + transactions effects are gated on (isAuthenticated && canReadFinance).
    expect(
      apiGet.mock.calls.some((c) =>
        String(c[0]).startsWith("/api/v1/finance/transactions")
      )
    ).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });

  it("pushes '/' when !isAuthenticated", async () => {
    authState.isAuthenticated = false;
    render(<TransactionsPage />);
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/");
    });
  });

  it("renders a spinner (no null) while authLoading, with no redirect yet", () => {
    authState.isLoading = true;
    const { container } = render(<TransactionsPage />);
    // authLoading gate fires the spinner branch (not return null) and does NOT redirect.
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("transactions — happy path + server filters (URLSearchParams)", () => {
  it("loads reference data + the unfiltered transactions list", async () => {
    await renderLoaded();
    expect(apiGet).toHaveBeenCalledWith("/api/v1/finance/accounts");
    expect(apiGet).toHaveBeenCalledWith("/api/v1/finance/categories");
    expect(apiGet).toHaveBeenCalledWith("/api/v1/finance/activity-areas");
    // No filters set → bare /transactions URL (no trailing ?).
    expect(apiGet).toHaveBeenCalledWith("/api/v1/finance/transactions");
    expect(screen.getByText("Hotel")).toBeInTheDocument();
  });

  it("appends from/to/type/accountId/categoryId via URLSearchParams when filters change", async () => {
    await renderLoaded();
    apiGet.mockClear();

    fireEvent.change(
      screen.getByText("filterByType").parentElement!.querySelector("select")!,
      {
        target: { value: "Income" },
      }
    );

    await waitFor(() => {
      expect(
        apiGet.mock.calls.some(
          (c) => c[0] === "/api/v1/finance/transactions?type=Income"
        )
      ).toBe(true);
    });
  });

  it("shows the empty state when no transactions match", async () => {
    apiGet.mockImplementation((url: string) => {
      if (url.startsWith("/api/v1/finance/transactions")) {
        return Promise.resolve({
          data: { items: [] },
          error: null,
          status: 200,
        });
      }
      return routeGet(url);
    });
    render(<TransactionsPage />);
    await waitFor(() => {
      expect(screen.getByText("noTransactions")).toBeInTheDocument();
    });
  });
});

describe("transactions — write guard (AC-3: create/edit/delete + receipt actions gated)", () => {
  it("hides New/Edit/Delete + attach affordances for a read-only user", async () => {
    authState.canWriteFinance = false;
    await renderLoaded();
    expect(screen.queryByText("newTransaction")).not.toBeInTheDocument();
    expect(screen.queryByTitle("editTransaction")).not.toBeInTheDocument();
    expect(screen.queryByTitle("delete")).not.toBeInTheDocument();
    expect(screen.queryByTitle("attachReceipt")).not.toBeInTheDocument();
    // The view-receipt button stays (read-only users can still view).
    expect(screen.getByTitle("viewReceipt")).toBeInTheDocument();
  });

  it("creates a transaction via POST /transactions for a write user", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText("newTransaction"));

    const dialog = (
      await screen.findByText("newTransaction", {
        selector: "h2",
      })
    ).closest("div.fixed") as HTMLElement;
    fireEvent.change(
      within(dialog)
        .getByText("description", { exact: false })
        .parentElement!.querySelector("input[name='description']")!,
      { target: { value: "New line" } }
    );
    fireEvent.change(dialog.querySelector("input[name='amount']")!, {
      target: { value: "9.99" },
    });
    fireEvent.change(dialog.querySelector("select[name='accountId']")!, {
      target: { value: "acc-1" },
    });
    fireEvent.change(dialog.querySelector("select[name='categoryId']")!, {
      target: { value: "cat-1" },
    });

    fireEvent.click(within(dialog).getByText("save"));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/transactions",
        expect.objectContaining({
          description: "New line",
          amount: 9.99,
          accountId: "acc-1",
          categoryId: "cat-1",
        })
      );
    });
  });

  it("edits a transaction via PUT /transactions/{id}", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByTitle("editTransaction")[0]);
    const dialog = (
      await screen.findByText("editTransaction", {
        selector: "h2",
      })
    ).closest("div.fixed") as HTMLElement;
    fireEvent.click(within(dialog).getByText("save"));

    await waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith(
        "/api/v1/finance/transactions/tx-1",
        expect.objectContaining({ description: "Office supplies" })
      );
    });
  });
});

describe("transactions — AC-5 delete-confirm modal (red), DELETE /transactions/{id}", () => {
  it("arms a confirm modal whose confirm button is red, then DELETEs on confirm", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByTitle("delete")[0]);

    // Confirm modal appears; no DELETE yet.
    const dialog = (
      await screen.findByText("confirmDelete", {
        exact: false,
      })
    ).closest("div.fixed") as HTMLElement;
    expect(apiDelete).not.toHaveBeenCalled();

    // A86: the confirm action ships red.
    const confirmBtn = within(dialog).getAllByText("delete").slice(-1)[0];
    expect(confirmBtn.className).toContain("bg-red-600");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalledWith(
        "/api/v1/finance/transactions/tx-1"
      );
    });
  });
});

describe("transactions — AC-6 receipt UPLOAD (FormData field 'file' + 'notes')", () => {
  it("uploads to POST /receipts with BOTH 'file' and 'notes' fields, then POSTs the link", async () => {
    await renderLoaded();
    // Open the attach modal for the no-receipt row.
    fireEvent.click(screen.getByTitle("attachReceipt"));
    const dialog = (await screen.findByText("attachReceiptTitle")).closest(
      "div.fixed"
    ) as HTMLElement;

    const fileInput = dialog.querySelector(
      "input[type='file']"
    ) as HTMLInputElement;
    const file = new File(["x"], "r.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Notes field appears once a file is staged.
    const notesInput = dialog.querySelector(
      "input[placeholder='notes']"
    ) as HTMLInputElement;
    fireEvent.change(notesInput, { target: { value: "expense scan" } });

    fireEvent.click(within(dialog).getByText("uploadAndAttach"));

    await waitFor(() => {
      expect(apiUpload).toHaveBeenCalledWith(
        "/api/v1/finance/receipts",
        expect.any(FormData)
      );
    });
    // Pin BOTH FormData fields (no JSON mutation; "notes" must survive).
    const fd = apiUpload.mock.calls[0][1] as FormData;
    expect(fd.get("file")).toBe(file);
    expect(fd.get("notes")).toBe("expense scan");

    // Then the freshly-uploaded receipt id is linked to the transaction.
    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/transactions/tx-1/receipt",
        { receiptId: "rcpt-new" }
      );
    });
  });

  it("links an existing receipt without uploading (no api.upload call)", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByTitle("attachReceipt"));
    const dialog = (await screen.findByText("attachReceiptTitle")).closest(
      "div.fixed"
    ) as HTMLElement;

    // The existing-receipt select is loaded from GET /receipts.
    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith("/api/v1/finance/receipts");
    });
    const select = dialog.querySelector("select") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "rcpt-1" } });

    fireEvent.click(within(dialog).getByText("uploadAndAttach"));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/transactions/tx-1/receipt",
        { receiptId: "rcpt-1" }
      );
    });
    expect(apiUpload).not.toHaveBeenCalled();
  });
});

describe("transactions — AC-5 receipt detach (immediate, no confirm)", () => {
  it("DELETEs /transactions/{id}/receipt with no confirmation modal", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByTitle("detachReceipt"));

    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalledWith(
        "/api/v1/finance/transactions/tx-2/receipt"
      );
    });
  });
});

describe("transactions — AC-6 receipt DOWNLOAD/PREVIEW branches", () => {
  it("PREVIEW branch: pdf/image → modal (GET info + GET blob, createObjectURL, no anchor download)", async () => {
    apiGet.mockImplementation((url: string) => {
      if (url === "/api/v1/finance/receipts/rcpt-9") {
        return Promise.resolve({
          data: {
            id: "rcpt-9",
            fileName: "invoice.pdf",
            contentType: "application/pdf",
            fileSize: 1,
            notes: "",
            createdAt: "2026-06-01T00:00:00Z",
          },
          error: null,
          status: 200,
        });
      }
      if (url === "/api/v1/finance/receipts/rcpt-9/download") {
        return Promise.resolve({
          data: new Blob(["%PDF"], { type: "application/pdf" }),
          error: null,
          status: 200,
        });
      }
      return routeGet(url);
    });
    await renderLoaded();
    fireEvent.click(screen.getByTitle("viewReceipt"));

    // Info GET then blob GET, both at the exact receipt URLs.
    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith("/api/v1/finance/receipts/rcpt-9");
    });
    expect(apiGet).toHaveBeenCalledWith(
      "/api/v1/finance/receipts/rcpt-9/download"
    );
    await waitFor(() => {
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
    // application/pdf → preview modal renders with the filename + download link.
    await waitFor(() => {
      expect(screen.getByText("invoice.pdf")).toBeInTheDocument();
    });
    const dl = screen
      .getByText("downloadReceipt")
      .closest("a") as HTMLAnchorElement;
    expect(dl.getAttribute("download")).toBe("invoice.pdf");

    // Deferred revoke: revokeObjectURL fires only on close, not on open.
    expect(global.URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it("DOWNLOAD branch: non-previewable → anchor download=fileName, APPENDED to body + removed + revoked", async () => {
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const removeSpy = vi.spyOn(document.body, "removeChild");
    const created: HTMLAnchorElement[] = [];
    const orig = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = orig(tag);
      if (tag === "a") {
        (el as HTMLAnchorElement).click = vi.fn();
        created.push(el as HTMLAnchorElement);
      }
      return el;
    });

    apiGet.mockImplementation((url: string) => {
      if (url === "/api/v1/finance/receipts/rcpt-9") {
        return Promise.resolve({
          data: {
            id: "rcpt-9",
            fileName: "data.bin",
            contentType: "application/octet-stream",
            fileSize: 1,
            notes: "",
            createdAt: "2026-06-01T00:00:00Z",
          },
          error: null,
          status: 200,
        });
      }
      if (url === "/api/v1/finance/receipts/rcpt-9/download") {
        return Promise.resolve({
          data: new Blob(["bin"], { type: "application/octet-stream" }),
          error: null,
          status: 200,
        });
      }
      return routeGet(url);
    });

    await renderLoaded();
    fireEvent.click(screen.getByTitle("viewReceipt"));

    await waitFor(() => {
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
    const anchor = created.find((a) => a.download === "data.bin");
    expect(anchor).toBeTruthy();
    // transactions-specific (contrast exports): the anchor IS appended + then removed.
    expect(appendSpy).toHaveBeenCalledWith(anchor!);
    expect(anchor!.click).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalledWith(anchor!);
    // Non-preview path revokes immediately (no modal).
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});
