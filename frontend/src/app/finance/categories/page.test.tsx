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
// E26-S1 (REQ-068 finance categories) S4 char-net — OUTLIER guard. GREEN at HEAD; pin AS-IS.
//
// A56 notes / deltas:
// - OUTLIER read-guard: reads `canReadFinance`/`canWriteFinance` only (NO isLoading wait).
//   The effect does `if (!canReadFinance) { router.replace("/"); return; }` AND render returns
//   `if (!canReadFinance) return null`. PREMATURE-REDIRECT-ON-COLD-SESSION quirk pinned AS-IS:
//   a transiently-false canReadFinance fires router.replace("/") immediately (do NOT "fix").
//   Redirect TARGET = "/" (not /login, not /finance/settings).
// - useApiClient-direct (BUILD-on-useApiClient); GET /categories → { items } envelope.
// - AC-5 delete: MODAL delete (a centred confirm dialog), NOT the inline two-step used by
//   budgets/activity-areas. Pinned per-surface. Destructive confirm button is bg-red-600.
// - A95: `type` is a closed Income/Expense set; no out-of-set round-trip risk.
// - A96: NO submitted field trimmed (form posted as-is; only enable-gate is `!form.name`).
// - Errors here use i18n KEYS (loadError/saveError/deleteError) — NOT hardcoded English.
// ============================================================================

const authState = {
  canReadFinance: true,
  canWriteFinance: true,
};

// next-intl: STABLE identity translator (A64/A78 — the page keeps `t` in a tRef; a stable identity
// keeps the data-load effect deterministic).
vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
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
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    canReadFinance: authState.canReadFinance,
    canWriteFinance: authState.canWriteFinance,
  }),
  useApiClient: () => ({
    get: apiGet,
    post: apiPost,
    put: apiPut,
    delete: apiDelete,
  }),
}));

import CategoriesPage from "./page";

const INCOME = {
  id: "c1",
  name: "Membership Fees",
  type: "Income" as const,
  color: "#22c55e",
  isActive: true,
};
const EXPENSE = {
  id: "c2",
  name: "Venue Rental",
  type: "Expense" as const,
  color: "#ef4444",
  isActive: false,
};

function wireApi(categories: unknown[] = [INCOME, EXPENSE]) {
  apiGet.mockImplementation(() =>
    Promise.resolve({ data: { items: categories }, error: null })
  );
}

beforeEach(() => {
  apiPost.mockResolvedValue({ data: {}, error: null });
  apiPut.mockResolvedValue({ data: {}, error: null });
  apiDelete.mockResolvedValue({ data: null, error: null });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  authState.canReadFinance = true;
  authState.canWriteFinance = true;
});

describe("CategoriesPage — OUTLIER guard (AC-2 premature redirect, pin AS-IS)", () => {
  it("redirects a read-denied user to '/' (target is /, not /login) and returns null", async () => {
    authState.canReadFinance = false;
    wireApi();
    const { container } = render(<CategoriesPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/");
    });
    // Render returns null — no table/heading, and NO categories GET fired.
    expect(container).toBeEmptyDOMElement();
    expect(apiGet).not.toHaveBeenCalled();
  });
});

describe("CategoriesPage — list + endpoints (AC-4)", () => {
  it("GETs /categories and renders rows with type badges", async () => {
    wireApi([INCOME, EXPENSE]);
    render(<CategoriesPage />);
    await waitFor(() => {
      expect(screen.getByText("Membership Fees")).toBeInTheDocument();
    });
    expect(apiGet).toHaveBeenCalledWith("/api/v1/finance/categories");
    expect(screen.getByText("Venue Rental")).toBeInTheDocument();
    // Type badges use the income/expense keys (closed set).
    expect(screen.getByText("income")).toBeInTheDocument();
    expect(screen.getByText("expense")).toBeInTheDocument();
  });

  it("shows the noCategories empty state", async () => {
    wireApi([]);
    render(<CategoriesPage />);
    await waitFor(() => {
      expect(screen.getByText("noCategories")).toBeInTheDocument();
    });
  });

  it("surfaces the loadError banner when the GET fails", async () => {
    apiGet.mockResolvedValue({ data: null, error: "boom" });
    render(<CategoriesPage />);
    await waitFor(() => {
      expect(screen.getByText("loadError")).toBeInTheDocument();
    });
  });
});

describe("CategoriesPage — write-gate (AC-3)", () => {
  it("shows New + per-row edit/delete for writers", async () => {
    wireApi([INCOME]);
    render(<CategoriesPage />);
    await waitFor(() => {
      expect(screen.getByText("newCategory")).toBeInTheDocument();
    });
    expect(screen.getByText("editCategory")).toBeInTheDocument();
    expect(screen.getByText("delete")).toBeInTheDocument();
  });

  it("hides New + actions for a read-only user", async () => {
    authState.canWriteFinance = false;
    wireApi([INCOME]);
    render(<CategoriesPage />);
    await waitFor(() => {
      expect(screen.getByText("Membership Fees")).toBeInTheDocument();
    });
    expect(screen.queryByText("newCategory")).not.toBeInTheDocument();
    expect(screen.queryByText("editCategory")).not.toBeInTheDocument();
    expect(screen.queryByText("delete")).not.toBeInTheDocument();
    // Actions header absent too.
    const rows = screen.getAllByRole("row");
    expect(within(rows[0]).queryByText("actions")).not.toBeInTheDocument();
  });
});

describe("CategoriesPage — create + edit (AC-4)", () => {
  it("POSTs the new category form to /categories", async () => {
    wireApi([]);
    render(<CategoriesPage />);
    await waitFor(() => {
      expect(screen.getByText("newCategory")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("newCategory"));

    // The modal name input is scoped within the create dialog — textbox[0] is the page SEARCH box,
    // so target the required name field via its modal sibling (the first textbox inside the dialog).
    const dialog = screen.getByText("newCategory", {
      selector: "h2",
    }).parentElement as HTMLElement;
    const nameInput = within(dialog).getAllByRole(
      "textbox"
    )[0] as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Donations" } });
    // Pick Expense from the closed Income/Expense select.
    fireEvent.change(within(dialog).getByRole("combobox"), {
      target: { value: "Expense" },
    });
    fireEvent.click(within(dialog).getByText("save"));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/categories",
        expect.objectContaining({
          name: "Donations",
          type: "Expense",
          isActive: true,
        })
      );
    });
  });

  it("PUTs the edited category to /categories/{id}", async () => {
    wireApi([INCOME]);
    render(<CategoriesPage />);
    await waitFor(() => {
      expect(screen.getByText("Membership Fees")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("editCategory"));
    // Modal heading uses the editCategory key (now there are 2 matches: button + heading).
    await waitFor(() => {
      expect(screen.getAllByText("editCategory").length).toBeGreaterThan(1);
    });
    fireEvent.click(screen.getByText("save"));

    await waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith(
        "/api/v1/finance/categories/c1",
        expect.objectContaining({
          name: "Membership Fees",
          type: "Income",
          isActive: true,
        })
      );
    });
  });

  it("shows the saveError banner when save fails", async () => {
    wireApi([]);
    apiPost.mockRejectedValue(new Error("network"));
    render(<CategoriesPage />);
    await waitFor(() => {
      expect(screen.getByText("newCategory")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("newCategory"));
    const dialog = screen.getByText("newCategory", {
      selector: "h2",
    }).parentElement as HTMLElement;
    fireEvent.change(within(dialog).getAllByRole("textbox")[0], {
      target: { value: "X" },
    });
    fireEvent.click(within(dialog).getByText("save"));

    await waitFor(() => {
      expect(screen.getByText("saveError")).toBeInTheDocument();
    });
  });
});

describe("CategoriesPage — MODAL delete (AC-5 — modal, NOT inline two-step)", () => {
  it("clicking row delete opens a confirm MODAL (no DELETE yet)", async () => {
    wireApi([INCOME]);
    render(<CategoriesPage />);
    await waitFor(() => {
      expect(screen.getByText("Membership Fees")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("delete"));
    // Modal copy renders; no DELETE fired yet.
    expect(screen.getByText("confirmDelete")).toBeInTheDocument();
    expect(apiDelete).not.toHaveBeenCalled();
  });

  it("confirming the modal DELETEs /categories/{id} (red confirm button)", async () => {
    wireApi([INCOME]);
    render(<CategoriesPage />);
    await waitFor(() => {
      expect(screen.getByText("Membership Fees")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("delete"));
    await waitFor(() => {
      expect(screen.getByText("confirmDelete")).toBeInTheDocument();
    });
    // The modal's confirm button is the last "delete"-labelled node and is bg-red-600.
    const deleteLabels = screen.getAllByText("delete");
    const confirmBtn = deleteLabels[deleteLabels.length - 1];
    expect(confirmBtn.className).toContain("bg-red-600");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalledWith("/api/v1/finance/categories/c1");
    });
  });

  it("cancelling the modal fires NO DELETE and closes it", async () => {
    wireApi([INCOME]);
    render(<CategoriesPage />);
    await waitFor(() => {
      expect(screen.getByText("Membership Fees")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("delete"));
    await waitFor(() => {
      expect(screen.getByText("confirmDelete")).toBeInTheDocument();
    });
    // The modal's cancel button.
    fireEvent.click(screen.getByText("cancel"));
    expect(apiDelete).not.toHaveBeenCalled();
    expect(screen.queryByText("confirmDelete")).not.toBeInTheDocument();
  });

  it("shows the deleteError banner when delete fails", async () => {
    wireApi([INCOME]);
    apiDelete.mockRejectedValue(new Error("network"));
    render(<CategoriesPage />);
    await waitFor(() => {
      expect(screen.getByText("Membership Fees")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("delete"));
    const deleteLabels = screen.getAllByText("delete");
    fireEvent.click(deleteLabels[deleteLabels.length - 1]);

    await waitFor(() => {
      expect(screen.getByText("deleteError")).toBeInTheDocument();
    });
  });
});
