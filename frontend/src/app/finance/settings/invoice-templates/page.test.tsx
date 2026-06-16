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

// E26-S1 (S6 settings group) — characterization net for the INVOICE TEMPLATES page.
// Behaviour-preservation ORACLE (A87). Pin AS-IS (A56).
//
// Load-bearing pins for the S6 migration:
//   - `{items}` GET envelope: list data comes as `{ items: [...] }` (cast through unknown).
//   - jurisdiction/countryCode immutability on edit: the jurisdiction <select> is rendered ONLY in
//     create mode (`!editingId`); the countryCode <input> is `disabled={editingId !== null}` on edit.
//   - modal delete (NOT inline-confirm) with a red confirm button.
//   - A95: language (en/de) + jurisdiction (CH/EU) selects round-trip the stored value.
//   - A96: optionals map "" → null on submit; nothing is `.trim()`ed.
//
// Guard shape pinned: `if (authLoading || loading) return <loading>` then renders the table. There is
//   NO `if (!canReadFinance) return null`. `loading` starts true and only flips inside the guarded
//   fetch → a non-read user is STUCK on tc("loading") and fires no GET.
//   // A56 note: brief says "renders empty table to a non-read user"; realised behaviour is
//   "stuck on loading" because `loading` is only cleared by the guarded fetch. Pinned AS-IS.
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

import InvoiceTemplatesPage from "./page";

const TEMPLATE_EU = {
  id: "tmpl-1",
  name: "EU Standard",
  jurisdiction: "EU",
  countryCode: "DE",
  isDefault: true,
  showVatId: true,
  showTaxExemptionNote: false,
  taxExemptionNote: null,
  showReverseChargeNote: false,
  reverseChargeNote: null,
  showPaymentTerms: true,
  defaultPaymentTerms: "30 days",
  showBankDetails: true,
  logoUrl: null,
  headerText: null,
  footerText: null,
  legalNotice: null,
  language: "de",
};

function wireTemplates(items: unknown[]) {
  apiGet.mockResolvedValue({ data: { items }, error: null, status: 200 });
}

beforeEach(() => {
  wireTemplates([TEMPLATE_EU]);
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

describe("InvoiceTemplatesPage — read/load guard (AC-2)", () => {
  it("shows loading while authLoading and fires no GET", () => {
    authState.isLoading = true;
    render(<InvoiceTemplatesPage />);

    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("stays on loading for a non-read user, fires no GET (no early return)", async () => {
    // A56 note: no `!canReadFinance` early-return; loading never clears → stuck on tc("loading").
    authState.canReadFinance = false;
    render(<InvoiceTemplatesPage />);

    await Promise.resolve();
    expect(apiGet).not.toHaveBeenCalled();
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("loads templates from the {items} envelope via GET /invoice-templates", async () => {
    render(<InvoiceTemplatesPage />);

    await waitFor(() => {
      expect(screen.getByText("EU Standard")).toBeInTheDocument();
    });
    expect(apiGet).toHaveBeenCalledWith("/api/v1/finance/invoice-templates");
    // Jurisdiction cell shows EU (DE); language shows DE (uppercased).
    expect(screen.getByText("DE")).toBeInTheDocument();
  });

  it("renders the empty state when items is empty", async () => {
    wireTemplates([]);
    render(<InvoiceTemplatesPage />);

    await waitFor(() => {
      expect(screen.getByText("noTemplatesTitle")).toBeInTheDocument();
    });
  });
});

describe("InvoiceTemplatesPage — write guard (AC-3)", () => {
  it("hides create button + row actions for a read-only user", async () => {
    authState.canWriteFinance = false;
    render(<InvoiceTemplatesPage />);

    await waitFor(() => {
      expect(screen.getByText("EU Standard")).toBeInTheDocument();
    });
    expect(screen.queryByText("create")).not.toBeInTheDocument();
    expect(screen.queryByTitle("edit")).not.toBeInTheDocument();
    expect(screen.queryByTitle("delete")).not.toBeInTheDocument();
    // Actions header column is also gated off.
    expect(screen.queryByText("actions")).not.toBeInTheDocument();
  });

  it("shows create + per-row edit/delete for a write user", async () => {
    render(<InvoiceTemplatesPage />);

    await waitFor(() => {
      expect(screen.getByText("EU Standard")).toBeInTheDocument();
    });
    expect(screen.getByText("create")).toBeInTheDocument();
    expect(screen.getByTitle("edit")).toBeInTheDocument();
    expect(screen.getByTitle("delete")).toBeInTheDocument();
  });
});

describe("InvoiceTemplatesPage — create vs edit field immutability (load-bearing)", () => {
  it("create dialog: jurisdiction SELECT shown, countryCode input ENABLED", async () => {
    render(<InvoiceTemplatesPage />);

    await waitFor(() => {
      expect(screen.getByText("create")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("create"));

    await waitFor(() => {
      expect(screen.getByText("createTitle")).toBeInTheDocument();
    });
    // jurisdiction is a <select> in create mode (rendered only when !editingId).
    const dialog = screen.getByText("createTitle").closest("div")!
      .parentElement as HTMLElement;
    const jurisdictionLabel = within(dialog).getByText("jurisdiction");
    expect(jurisdictionLabel).toBeInTheDocument();
    // The jurisdiction <select> exists (value CH/EU).
    const selects = dialog.querySelectorAll("select");
    const jurisdictionSelect = Array.from(selects).find((s) =>
      Array.from(s.options).some((o) => o.value === "CH")
    );
    expect(jurisdictionSelect).toBeTruthy();
    // countryCode input is enabled in create mode (editingId === null).
    const countryInput = dialog.querySelector(
      'input[maxlength="2"]'
    ) as HTMLInputElement;
    expect(countryInput).not.toBeDisabled();
  });

  it("edit dialog: jurisdiction SELECT absent, countryCode input DISABLED (immutable)", async () => {
    render(<InvoiceTemplatesPage />);

    await waitFor(() => {
      expect(screen.getByText("EU Standard")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle("edit"));

    await waitFor(() => {
      expect(screen.getByText("editTitle")).toBeInTheDocument();
    });
    const dialog = screen.getByText("editTitle").closest("div")!
      .parentElement as HTMLElement;
    // No jurisdiction <select> with a CH option in edit mode.
    const selects = Array.from(dialog.querySelectorAll("select"));
    const jurisdictionSelect = selects.find((s) =>
      Array.from(s.options).some((o) => o.value === "CH")
    );
    expect(jurisdictionSelect).toBeUndefined();
    // countryCode input is disabled (editingId !== null) and preloaded with the stored value.
    const countryInput = dialog.querySelector(
      'input[maxlength="2"]'
    ) as HTMLInputElement;
    expect(countryInput).toBeDisabled();
    expect(countryInput.value).toBe("DE");
  });

  it("editing PUTs to /invoice-templates/{id}", async () => {
    render(<InvoiceTemplatesPage />);

    await waitFor(() => {
      expect(screen.getByText("EU Standard")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle("edit"));
    await waitFor(() => {
      expect(screen.getByText("editTitle")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("save"));

    await waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith(
        "/api/v1/finance/invoice-templates/tmpl-1",
        expect.objectContaining({ name: "EU Standard", language: "de" })
      );
    });
  });
});

describe("InvoiceTemplatesPage — create POST + A95/A96", () => {
  it("create POSTs the new template; jurisdiction/language round-trip + optionals null (A95/A96)", async () => {
    const { container } = render(<InvoiceTemplatesPage />);

    await waitFor(() => {
      expect(screen.getByText("create")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("create"));
    await waitFor(() => {
      expect(screen.getByText("createTitle")).toBeInTheDocument();
    });
    // Name is required by the disabled-gate (!form.name || !form.language). Scope to the modal
    // overlay (the page search box is also a text input); name is the first text input in the dialog.
    const dialog = container.querySelector(".fixed.inset-0") as HTMLElement;
    const nameInput = dialog.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "CH Template" } });
    fireEvent.click(screen.getByText("save"));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/invoice-templates",
        expect.objectContaining({
          name: "CH Template",
          // DEFAULT_FORM jurisdiction is EU, language en (A95 — full union, not the rendered subset).
          jurisdiction: "EU",
          language: "en",
        })
      );
    });
    const payload = apiPost.mock.calls[0][1] as Record<string, unknown>;
    // A96: empty optionals → null, untrimmed required name.
    expect(payload.countryCode).toBeNull();
    expect(payload.taxExemptionNote).toBeNull();
    expect(payload.headerText).toBeNull();
    expect(payload.name).toBe("CH Template");
  });

  it("save is disabled until a name is entered (no validation lib)", async () => {
    render(<InvoiceTemplatesPage />);

    await waitFor(() => {
      expect(screen.getByText("create")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("create"));
    await waitFor(() => {
      expect(screen.getByText("createTitle")).toBeInTheDocument();
    });
    expect(screen.getByText("save").closest("button")).toBeDisabled();
  });
});

describe("InvoiceTemplatesPage — modal delete (AC-5)", () => {
  it("delete uses a MODAL (not inline-confirm) and DELETEs /invoice-templates/{id}", async () => {
    render(<InvoiceTemplatesPage />);

    await waitFor(() => {
      expect(screen.getByText("EU Standard")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle("delete"));

    // Modal confirm copy appears; no DELETE yet.
    await waitFor(() => {
      expect(screen.getByText("deleteConfirm")).toBeInTheDocument();
    });
    expect(apiDelete).not.toHaveBeenCalled();

    // The modal confirm button is the labelled "delete" button inside the dialog.
    const confirmBtns = screen.getAllByText("delete");
    fireEvent.click(confirmBtns[confirmBtns.length - 1]);

    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalledWith(
        "/api/v1/finance/invoice-templates/tmpl-1"
      );
    });
  });

  it("keeps the modal open and surfaces the error key on a failed delete", async () => {
    apiDelete.mockResolvedValue({ data: null, error: "boom", status: 500 });
    render(<InvoiceTemplatesPage />);

    await waitFor(() => {
      expect(screen.getByText("EU Standard")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle("delete"));
    await waitFor(() => {
      expect(screen.getByText("deleteConfirm")).toBeInTheDocument();
    });
    const confirmBtns = screen.getAllByText("delete");
    fireEvent.click(confirmBtns[confirmBtns.length - 1]);

    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalled();
    });
    // tit("error") banner surfaces.
    await waitFor(() => {
      expect(screen.getByText("error")).toBeInTheDocument();
    });
  });
});
