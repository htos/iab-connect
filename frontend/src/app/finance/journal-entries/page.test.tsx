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

// REQ-044 (E6-S2) AC-1: the DoubleEntry journal-line editor exposes a cost-center (ActivityArea)
// selector — the gap-fill this story added. Confirms the selector renders the active areas plus the
// "no cost center" option once the create dialog is open.

// next-intl: stable identity translator (A64).
vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

// E26-S1 extension: expose the router `replace` spy + mutable auth + post/put spies so the
// extended suites can flip permissions and assert mutations. The original cost-center test only
// reads `apiGet`, so it is unaffected.
const replaceFromRouter = vi.fn();
// STABLE router object (A78) — a fresh object per render churns useEffect([router]) deps and
// re-fires the mode-check + list fetch every render. Define it ONCE.
const routerObj = {
  replace: replaceFromRouter,
  push: vi.fn(),
  refresh: vi.fn(),
};
vi.mock("next/navigation", () => ({
  useRouter: () => routerObj,
}));

const apiGet = vi.fn();
const apiPostSpy = vi.fn();
const apiPutSpy = vi.fn();
const authStateRef = {
  canReadFinance: true,
  canWriteFinance: true,
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authStateRef,
  useApiClient: () => ({
    get: apiGet,
    post: apiPostSpy,
    put: apiPutSpy,
  }),
}));

import JournalEntriesPage from "./page";

function wireApi() {
  apiGet.mockImplementation((url: string) => {
    if (url.includes("/finance/profile")) {
      return Promise.resolve({ data: { accountingMode: "DoubleEntry" } });
    }
    if (url.includes("/ledger-accounts")) {
      return Promise.resolve({
        data: {
          items: [
            { id: "l1", number: "6000", name: "Expenses", isActive: true },
          ],
        },
      });
    }
    if (url.includes("/tax-codes")) {
      return Promise.resolve({ data: { items: [] } });
    }
    if (url.includes("/activity-areas")) {
      return Promise.resolve({
        data: {
          items: [{ id: "a1", name: "Events", code: "EVT", isActive: true }],
        },
      });
    }
    // journal-entries list
    return Promise.resolve({ data: { items: [] } });
  });
}

beforeEach(() => {
  apiPostSpy.mockResolvedValue({ data: {}, error: null });
  apiPutSpy.mockResolvedValue({ data: {}, error: null });
});

afterEach(() => {
  cleanup();
  apiGet.mockReset();
  apiPostSpy.mockReset();
  apiPutSpy.mockReset();
  replaceFromRouter.mockReset();
  authStateRef.canReadFinance = true;
  authStateRef.canWriteFinance = true;
});

describe("JournalEntriesPage cost-center selector", () => {
  it("renders the ActivityArea selector with active areas in the create dialog", async () => {
    wireApi();
    render(<JournalEntriesPage />);

    // Wait for the DoubleEntry mode-check + data load to settle (New button appears).
    await waitFor(() => {
      expect(screen.getByText("newJournalEntry")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("newJournalEntry"));

    // The line editor renders a cost-center column with the active area + "no cost center" option.
    await waitFor(() => {
      expect(screen.getAllByText("EVT – Events").length).toBeGreaterThanOrEqual(
        1
      );
    });
    expect(screen.getAllByText("noActivityArea").length).toBeGreaterThanOrEqual(
      1
    );
  });
});

// ============================================================================
// E26-S1 (S2 ledger/accounting) — EXTENDED characterization net (do NOT rewrite above).
//
// A56 note: guard CONFIRMED lean role-only + DoubleEntry mode guard (GET /api/v1/finance/profile;
//   router.replace("/finance/settings") unless accountingMode === "DoubleEntry"; data waits on
//   modeChecked). `if (!canReadFinance) router.replace("/")` + render-time `return null`.
//
// A79 deltas:
//  - AC-5 failure branch: handleSave AND handleAction (post/reverse) THROW on res.error → catch →
//    setError + KEEP THE MODAL OPEN (no close). Pinned below.
//  - post button = bg-green-600 (row link text-green-600); reverse = bg-red-600 (row link text-red-600).
//  - Edit is Draft-ONLY (status === "Draft" && canWriteFinance); Post is Draft-only; Reverse is Posted-only.
//  - balance gate: isBalanced = |totalDebit - totalCredit| < 0.005 AND >= 2 lines kept; gates Save.
//  - status filter is SERVER-side (?status=<S>); the search box filters CLIENT-side.
//  - A95: ledger / tax-code / activity-area <select>s are filtered to isActive on render.
// ============================================================================

describe("JournalEntriesPage — DoubleEntry mode guard (AC-2, A56)", () => {
  it("redirects to /finance/settings when accountingMode !== DoubleEntry", async () => {
    apiGet.mockImplementation((url: string) => {
      if (url.includes("/finance/profile")) {
        return Promise.resolve({ data: { accountingMode: "SingleEntry" } });
      }
      return Promise.resolve({ data: { items: [] } });
    });
    render(<JournalEntriesPage />);
    await waitFor(() => {
      expect(replaceFromRouter).toHaveBeenCalledWith("/finance/settings");
    });
    // List GET is gated on modeChecked — never fires when redirected.
    expect(
      apiGet.mock.calls.some((c) => c[0].includes("/journal-entries"))
    ).toBe(false);
  });
});

describe("JournalEntriesPage — status filter (server) + client search (AC-4)", () => {
  it("appends ?status=Draft to the list GET when the status filter changes", async () => {
    wireApi();
    render(<JournalEntriesPage />);
    // Wait for the mode-check + initial (unfiltered) list GET to fire.
    await waitFor(() => {
      expect(
        apiGet.mock.calls.some(
          (c) => c[0] === "/api/v1/finance/journal-entries"
        )
      ).toBe(true);
    });
    const statusSelect = screen.getByDisplayValue("allStatuses");
    fireEvent.change(statusSelect, { target: { value: "Draft" } });
    await waitFor(() => {
      expect(
        apiGet.mock.calls.some(
          (c) => c[0] === "/api/v1/finance/journal-entries?status=Draft"
        )
      ).toBe(true);
    });
  });
});

function wireEntries(entries: unknown[]) {
  apiGet.mockImplementation((url: string) => {
    if (url.includes("/finance/profile"))
      return Promise.resolve({ data: { accountingMode: "DoubleEntry" } });
    if (url.includes("/ledger-accounts"))
      return Promise.resolve({
        data: {
          items: [
            { id: "l1", number: "6000", name: "Expenses", isActive: true },
            { id: "l2", number: "1000", name: "Cash", isActive: true },
          ],
        },
      });
    if (url.includes("/tax-codes"))
      return Promise.resolve({ data: { items: [] } });
    if (url.includes("/activity-areas"))
      return Promise.resolve({ data: { items: [] } });
    if (url.match(/\/journal-entries\/[^/]+$/)) {
      // detail / edit-load for a single id
      return Promise.resolve({ data: entries[0] });
    }
    return Promise.resolve({ data: { items: entries } });
  });
}

const draftEntry = {
  id: "j1",
  date: "2026-01-05",
  description: "Office rent",
  reference: "REF-1",
  status: "Draft",
  sourceType: "Manual",
  lines: [
    {
      id: "ln1",
      ledgerAccountId: "l1",
      ledgerAccountNumber: "6000",
      ledgerAccountName: "Expenses",
      debitAmount: 100,
      creditAmount: 0,
      taxCodeId: null,
      netAmount: 100,
      taxAmount: 0,
      activityAreaId: null,
    },
    {
      id: "ln2",
      ledgerAccountId: "l2",
      ledgerAccountNumber: "1000",
      ledgerAccountName: "Cash",
      debitAmount: 0,
      creditAmount: 100,
      taxCodeId: null,
      netAmount: 100,
      taxAmount: 0,
      activityAreaId: null,
    },
  ],
};
const postedEntry = { ...draftEntry, id: "j2", status: "Posted" };

describe("JournalEntriesPage — write guards: Post(Draft)/Reverse(Posted)/Edit(Draft) (AC-3)", () => {
  it("Draft row shows Edit + Post; Post link is text-green-600", async () => {
    wireEntries([draftEntry]);
    render(<JournalEntriesPage />);
    await waitFor(() => {
      expect(screen.getByText("Office rent")).toBeInTheDocument();
    });
    expect(screen.getByText("edit")).toBeInTheDocument();
    const postLink = screen.getByText("post");
    expect(postLink.className).toContain("text-green-600");
    // No reverse on a Draft.
    expect(screen.queryByText("reverse")).not.toBeInTheDocument();
  });

  it("Posted row shows Reverse (text-red-600) and NO Edit/Post", async () => {
    wireEntries([postedEntry]);
    render(<JournalEntriesPage />);
    await waitFor(() => {
      expect(screen.getByText("Office rent")).toBeInTheDocument();
    });
    const reverseLink = screen.getByText("reverse");
    expect(reverseLink.className).toContain("text-red-600");
    expect(screen.queryByText("edit")).not.toBeInTheDocument();
    expect(screen.queryByText("post")).not.toBeInTheDocument();
  });

  it("hides Edit/Post/Reverse when canReadFinance && !canWriteFinance", async () => {
    authStateRef.canWriteFinance = false;
    wireEntries([draftEntry]);
    render(<JournalEntriesPage />);
    await waitFor(() => {
      expect(screen.getByText("Office rent")).toBeInTheDocument();
    });
    expect(screen.queryByText("edit")).not.toBeInTheDocument();
    expect(screen.queryByText("post")).not.toBeInTheDocument();
    expect(screen.queryByText("reverse")).not.toBeInTheDocument();
    // View is always available.
    expect(screen.getByText("view")).toBeInTheDocument();
  });
});

describe("JournalEntriesPage — post/reverse confirm + colour + failure-keeps-modal (AC-5)", () => {
  it("POSTs to /{id}/post via the green confirm button", async () => {
    wireEntries([draftEntry]);
    render(<JournalEntriesPage />);
    await waitFor(() => {
      expect(screen.getByText("Office rent")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("post"));
    // Confirm modal: post copy + green confirm button (bg-green-600).
    expect(screen.getByText("confirmPost")).toBeInTheDocument();
    const confirmBtn = screen
      .getAllByText("post")
      .find((n) => n.className.includes("bg-green-600"))!;
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(apiPostSpy).toHaveBeenCalledWith(
        "/api/v1/finance/journal-entries/j1/post",
        {}
      );
    });
  });

  it("A56: post failure KEEPS THE CONFIRM MODAL OPEN and shows saveError", async () => {
    wireEntries([draftEntry]);
    apiPostSpy.mockResolvedValue({ data: null, error: "boom" });
    render(<JournalEntriesPage />);
    await waitFor(() => {
      expect(screen.getByText("Office rent")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("post"));
    const confirmBtn = screen
      .getAllByText("post")
      .find((n) => n.className.includes("bg-green-600"))!;
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(screen.getByText("saveError")).toBeInTheDocument();
    });
    // Modal still open (confirmPost copy persists).
    expect(screen.getByText("confirmPost")).toBeInTheDocument();
  });

  it("POSTs to /{id}/reverse via the red confirm button", async () => {
    wireEntries([postedEntry]);
    render(<JournalEntriesPage />);
    await waitFor(() => {
      expect(screen.getByText("Office rent")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("reverse"));
    expect(screen.getByText("confirmReverse")).toBeInTheDocument();
    const confirmBtn = screen
      .getAllByText("reverse")
      .find((n) => n.className.includes("bg-red-600"))!;
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(apiPostSpy).toHaveBeenCalledWith(
        "/api/v1/finance/journal-entries/j2/reverse",
        {}
      );
    });
  });
});

describe("JournalEntriesPage — edit-load (Draft-only) + balance gate (AC-4/AC-5)", () => {
  it("edit-load GETs /journal-entries/{id} and opens the editor", async () => {
    wireEntries([draftEntry]);
    render(<JournalEntriesPage />);
    await waitFor(() => {
      expect(screen.getByText("Office rent")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("edit"));
    await waitFor(() => {
      expect(screen.getByText("editJournalEntry")).toBeInTheDocument();
    });
    expect(
      apiGet.mock.calls.some(
        (c) => c[0] === "/api/v1/finance/journal-entries/j1"
      )
    ).toBe(true);
  });

  it("balance gate: an empty new entry reads 'balanced' (0=0) but Save is disabled (empty desc)", async () => {
    // A56: |0 - 0| < 0.005 → isBalanced=true even on a fresh entry; Save is disabled by the
    // empty description/date guard, NOT the balance guard. Pin BOTH facts AS-IS.
    wireEntries([]);
    render(<JournalEntriesPage />);
    await waitFor(() => {
      expect(screen.getByText("newJournalEntry")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("newJournalEntry"));
    await waitFor(() => {
      expect(screen.getByText("balanced")).toBeInTheDocument();
    });
    expect(screen.getByText("save")).toBeDisabled();
  });

  it("balance gate: an asymmetric entry (debit≠credit) reads 'notBalanced' and disables Save", async () => {
    wireEntries([]);
    render(<JournalEntriesPage />);
    await waitFor(() => {
      expect(screen.getByText("newJournalEntry")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("newJournalEntry"));
    await waitFor(() => {
      expect(screen.getByText("balanced")).toBeInTheDocument();
    });
    // Put a debit on line 1 only → totals diverge by 50 → |50-0| >= 0.005 → notBalanced.
    const numberInputs = document.querySelectorAll('input[type="number"]');
    fireEvent.change(numberInputs[0], { target: { value: "50" } });
    await waitFor(() => {
      expect(screen.getByText("notBalanced")).toBeInTheDocument();
    });
    expect(screen.getByText("save")).toBeDisabled();
  });
});
