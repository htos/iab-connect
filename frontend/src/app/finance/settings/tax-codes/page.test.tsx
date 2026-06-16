// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// E26-S1 (S6 settings group) — characterization net for the SETTINGS TAX-CODES page.
// Behaviour-preservation ORACLE (A87). Pin AS-IS (A56).
//
// Load-bearing pins for the S6 RHF+Zod migration:
//   - rate ×100 (display) / ÷100 (wire) round-trip: the table renders `(rate*100).toFixed(2)%`; the
//     edit dialog loads `rate*100` into the form; SAVE submits `rate/100`. A stored 0.077 displays as
//     "7.70%", edits to a form value of 7.7, and a no-touch save re-submits 0.077. Pin EXACTLY — a Zod
//     schema regression that drops the ÷100 must go RED.
//   - `{items}` GET envelope.
//   - MODAL delete (not inline-confirm) with a red confirm button.
//
// Guard shape pinned: `if (authLoading || loading) return <loading>` then renders the table. NO
//   `if (!canReadFinance) return null`. `loading` starts true, only flips inside the guarded fetch →
//   a non-read user is stuck on tc("loading") and fires no GET.
//   // A56 note: brief says "renders empty table to a non-read user"; realised behaviour is "stuck on
//   loading". Pinned AS-IS — do NOT add a guard.
//
// A79 deltas: all transport via `useApiClient` direct; no QueryClientProvider (god-page pre-TanStack).

vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

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
  isLoading: false,
  canReadFinance: true,
  canWriteFinance: true,
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

import TaxCodesPage from "./page";

// Stored rate is a fraction (0.077 = 7.7%). Display ×100, wire ÷100.
const TAX_CODE = {
  id: "tax-1",
  code: "VAT-STD",
  label: "Standard VAT",
  rate: 0.077,
  isDefault: true,
  isActive: true,
  createdAt: "2026-05-14T00:00:00Z",
  updatedAt: "2026-05-14T00:00:00Z",
};

function wireTaxCodes(items: unknown[]) {
  apiGet.mockResolvedValue({ data: { items }, error: null, status: 200 });
}

beforeEach(() => {
  wireTaxCodes([TAX_CODE]);
  apiPost.mockResolvedValue({ data: {}, error: null, status: 200 });
  apiPut.mockResolvedValue({ data: {}, error: null, status: 200 });
  apiDelete.mockResolvedValue({ data: null, error: null, status: 200 });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  authState.isLoading = false;
  authState.canReadFinance = true;
  authState.canWriteFinance = true;
});

describe("TaxCodesPage — read/load guard (AC-2)", () => {
  it("shows loading while authLoading and fires no GET", () => {
    authState.isLoading = true;
    render(<TaxCodesPage />);

    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("stays on loading for a non-read user, fires no GET (no early return)", async () => {
    // A56 note: no `!canReadFinance` early-return; loading never clears → stuck on tc("loading").
    authState.canReadFinance = false;
    render(<TaxCodesPage />);

    await Promise.resolve();
    expect(apiGet).not.toHaveBeenCalled();
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("loads codes from the {items} envelope via GET /tax-codes", async () => {
    render(<TaxCodesPage />);

    await waitFor(() => {
      expect(screen.getByText("VAT-STD")).toBeInTheDocument();
    });
    expect(apiGet).toHaveBeenCalledWith("/api/v1/finance/tax-codes");
    expect(screen.getByText("Standard VAT")).toBeInTheDocument();
  });

  it("renders the empty state when items is empty", async () => {
    wireTaxCodes([]);
    render(<TaxCodesPage />);

    await waitFor(() => {
      expect(screen.getByText("noTaxCodes")).toBeInTheDocument();
    });
  });
});

describe("TaxCodesPage — rate ×100/÷100 round-trip (load-bearing)", () => {
  it("displays the stored fraction ×100 in the table (0.077 → 7.70%)", async () => {
    render(<TaxCodesPage />);

    await waitFor(() => {
      expect(screen.getByText("VAT-STD")).toBeInTheDocument();
    });
    // Cell renders `(rate*100).toFixed(2)%`.
    expect(screen.getByText("7.70%")).toBeInTheDocument();
  });

  it("edit dialog loads rate×100 and a no-touch save re-submits rate÷100 (0.077)", async () => {
    const { container } = render(<TaxCodesPage />);

    await waitFor(() => {
      expect(screen.getByText("VAT-STD")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle("editTaxCode"));
    await waitFor(() => {
      expect(screen.getByText("editTaxCode")).toBeInTheDocument();
    });
    // The rate <input type=number> is preloaded with 7.7 (0.077 * 100).
    const rateInput = container.querySelector(
      'input[type="number"]'
    ) as HTMLInputElement;
    expect(rateInput.value).toBe("7.7");

    // No touch-edit — save. Payload divides by 100 → back to 0.077.
    fireEvent.click(screen.getByText("save"));
    await waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith(
        "/api/v1/finance/tax-codes/tax-1",
        expect.objectContaining({ rate: 0.077, code: "VAT-STD" })
      );
    });
  });

  it("create submits the entered percentage ÷100 (8.1 → 0.081)", async () => {
    const { container } = render(<TaxCodesPage />);

    await waitFor(() => {
      expect(screen.getByText("addTaxCode")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("addTaxCode"));
    await waitFor(() => {
      // Title key === "addTaxCode" in create mode (button + modal title).
      expect(screen.getAllByText("addTaxCode").length).toBeGreaterThan(0);
    });
    // Scope to the modal overlay (the page search box is also a text input). Order: code, label.
    const dialog = container.querySelector(".fixed.inset-0") as HTMLElement;
    const textInputs = dialog.querySelectorAll('input[type="text"]');
    fireEvent.change(textInputs[0], { target: { value: "VAT-RED" } }); // code
    fireEvent.change(textInputs[1], { target: { value: "Reduced VAT" } }); // label
    const rateInput = dialog.querySelector(
      'input[type="number"]'
    ) as HTMLInputElement;
    fireEvent.change(rateInput, { target: { value: "8.1" } });
    fireEvent.click(screen.getByText("save"));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/tax-codes",
        expect.objectContaining({
          code: "VAT-RED",
          label: "Reduced VAT",
          rate: 0.081,
        })
      );
    });
  });
});

describe("TaxCodesPage — status column", () => {
  it("renders the active/inactive status badge from the finance namespace", async () => {
    wireTaxCodes([
      TAX_CODE,
      { ...TAX_CODE, id: "tax-2", code: "VAT-OLD", isActive: false },
    ]);
    render(<TaxCodesPage />);

    await waitFor(() => {
      expect(screen.getByText("VAT-OLD")).toBeInTheDocument();
    });
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText("inactive")).toBeInTheDocument();
  });
});

describe("TaxCodesPage — write guard (AC-3)", () => {
  it("hides add button + row actions for a read-only user", async () => {
    authState.canWriteFinance = false;
    render(<TaxCodesPage />);

    await waitFor(() => {
      expect(screen.getByText("VAT-STD")).toBeInTheDocument();
    });
    expect(screen.queryByText("addTaxCode")).not.toBeInTheDocument();
    expect(screen.queryByTitle("editTaxCode")).not.toBeInTheDocument();
    expect(screen.queryByTitle("delete")).not.toBeInTheDocument();
  });

  it("shows add + per-row edit/delete for a write user", async () => {
    render(<TaxCodesPage />);

    await waitFor(() => {
      expect(screen.getByText("VAT-STD")).toBeInTheDocument();
    });
    expect(screen.getByText("addTaxCode")).toBeInTheDocument();
    expect(screen.getByTitle("editTaxCode")).toBeInTheDocument();
    expect(screen.getByTitle("delete")).toBeInTheDocument();
  });
});

describe("TaxCodesPage — modal delete (AC-5)", () => {
  it("delete uses a MODAL (not inline) and DELETEs /tax-codes/{id}", async () => {
    render(<TaxCodesPage />);

    await waitFor(() => {
      expect(screen.getByText("VAT-STD")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle("delete"));

    // Modal confirm copy appears; the title (t) and body (ttc) BOTH resolve to "confirmDelete" → 2 nodes.
    await waitFor(() => {
      expect(screen.getAllByText("confirmDelete").length).toBe(2);
    });
    expect(apiDelete).not.toHaveBeenCalled();

    // The red confirm button is the labelled "delete" button inside the modal.
    const deleteBtns = screen.getAllByText("delete");
    fireEvent.click(deleteBtns[deleteBtns.length - 1]);

    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalledWith("/api/v1/finance/tax-codes/tax-1");
    });
  });

  it("shows the deleteError on a failed delete", async () => {
    apiDelete.mockResolvedValue({ data: null, error: "boom", status: 500 });
    render(<TaxCodesPage />);

    await waitFor(() => {
      expect(screen.getByText("VAT-STD")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle("delete"));
    await waitFor(() => {
      expect(screen.getAllByText("confirmDelete").length).toBe(2);
    });
    const deleteBtns = screen.getAllByText("delete");
    fireEvent.click(deleteBtns[deleteBtns.length - 1]);

    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalled();
    });
    // catch sets t("deleteError").
    await waitFor(() => {
      expect(screen.getByText("deleteError")).toBeInTheDocument();
    });
  });
});
