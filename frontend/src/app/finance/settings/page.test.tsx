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

// E26-S1 (S6 settings group) — characterization net for the Finance Settings HUB page.
// Behaviour-preservation ORACLE (A87). Pins the CURRENT god-page behaviour AS-IS (A56) — do NOT
// "fix" quirks. The hub: static nav-card arrays, DoubleEntry-derived setup/operational card
// enable/disable, the `isDoubleEntry && canWriteFinance` backfill panel, the `canWriteFinance`
// danger-zone reset with a typed-word confirm gate, and the `finance-profile-changed` CustomEvent
// dispatched on a successful reset.
//
// Guard shape pinned: spinner while `authLoading || !profileLoaded` → `if (!canReadFinance) return null`
//   (NO redirect). For a non-read user the profile GET never fires (effect is `if (canReadFinance)`),
//   so `profileLoaded` stays false → the page is STUCK on the spinner and never reaches `return null`.
//   // A56 note: the brief calls this "spinner-while-!profileLoaded → return null"; the realised
//   behaviour for a non-read user is "stuck on spinner" because profileLoaded is only set by the
//   guarded fetch. Pinned AS-IS.
//
// A79 deltas: ALL transport via `useApiClient` direct (mock the bag; S6 hooks keep calling it → net
//   survives migration with ZERO transport edits — the A94 BUILD case). No `.trim()` on submitted
//   bytes. No `QueryClientProvider` (god-page is pre-TanStack).

// next-intl: STABLE identity translator (A64/A78 — define ONCE, return the same fn).
vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

// next/link: passthrough (preserve href for nav-card assertions).
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

import FinanceSettingsPage from "./page";

const PROFILE_DOUBLE_ENTRY = { accountingMode: "DoubleEntry" };
const PROFILE_SIMPLE_CASH = { accountingMode: "SimpleCash" };

function wireProfile(profile: unknown) {
  apiGet.mockImplementation((url: string) => {
    if (url === "/api/v1/finance/profile") {
      return Promise.resolve({ data: profile, error: null, status: 200 });
    }
    return Promise.resolve({ data: null, error: null, status: 200 });
  });
}

beforeEach(() => {
  wireProfile(PROFILE_SIMPLE_CASH);
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

describe("FinanceSettingsPage — read guard (AC-2)", () => {
  it("shows the spinner while authLoading (the GET still fires — effect gates on canReadFinance only)", async () => {
    // A56 note: the profile-fetch effect is `if (canReadFinance) fetchProfile()` — it does NOT gate on
    // authLoading, so the GET fires even during the loading state. Pinned AS-IS.
    authState.isLoading = true;
    const { container } = render(<FinanceSettingsPage />);

    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    expect(screen.queryByText("title")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith("/api/v1/finance/profile");
    });
  });

  it("stays on the spinner for a non-read user (profileLoaded never set, no GET, no redirect)", async () => {
    // A56 note: the page has no redirect; the guarded fetch never runs for a non-read user, so
    // profileLoaded stays false and the spinner persists (it never reaches `if (!canReadFinance) return null`).
    authState.canReadFinance = false;
    const { container } = render(<FinanceSettingsPage />);

    await Promise.resolve();
    expect(apiGet).not.toHaveBeenCalled();
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    expect(screen.queryByText("title")).not.toBeInTheDocument();
  });

  it("renders the hub once the profile is loaded for a read user (GET /profile)", async () => {
    render(<FinanceSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("title")).toBeInTheDocument();
    });
    expect(apiGet).toHaveBeenCalledWith("/api/v1/finance/profile");
    expect(screen.getByText("settingsHub.subtitle")).toBeInTheDocument();
  });
});

describe("FinanceSettingsPage — static nav cards", () => {
  it("renders the always-visible profile + general + simple-cash cards with hrefs", async () => {
    const { container } = render(<FinanceSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("settingsHub.profile")).toBeInTheDocument();
    });
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) =>
      a.getAttribute("href")
    );
    // Profile section
    expect(hrefs).toContain("/finance/settings/profile");
    // General section
    expect(hrefs).toContain("/finance/accounts");
    expect(hrefs).toContain("/finance/categories");
    expect(hrefs).toContain("/finance/settings/tax-codes");
    expect(hrefs).toContain("/finance/settings/invoice-templates");
    expect(hrefs).toContain("/finance/settings/activity-areas");
    // Simple-cash section
    expect(hrefs).toContain("/finance/exports");
    expect(hrefs).toContain("/finance/bank-import");
  });

  it("renders accounting setup cards DISABLED (locked) when not DoubleEntry; operational cards absent", async () => {
    wireProfile(PROFILE_SIMPLE_CASH);
    const { container } = render(<FinanceSettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByText("settingsHub.ledgerAccounts")
      ).toBeInTheDocument();
    });
    // Setup cards are rendered as disabled (cursor-not-allowed + requiresDoubleEntry note).
    expect(container.querySelector(".cursor-not-allowed")).toBeInTheDocument();
    expect(
      screen.getAllByText("settingsHub.requiresDoubleEntry").length
    ).toBeGreaterThan(0);
    // Operational cards (journal-entries / accounting-reports) are NOT rendered.
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) =>
      a.getAttribute("href")
    );
    expect(hrefs).not.toContain("/finance/journal-entries");
    expect(hrefs).not.toContain("/finance/accounting-reports");
    expect(
      screen.getByText("settingsHub.doubleEntryInactive")
    ).toBeInTheDocument();
  });

  it("renders accounting setup + operational cards as links when DoubleEntry", async () => {
    wireProfile(PROFILE_DOUBLE_ENTRY);
    const { container } = render(<FinanceSettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByText("settingsHub.doubleEntryActive")
      ).toBeInTheDocument();
    });
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) =>
      a.getAttribute("href")
    );
    expect(hrefs).toContain("/finance/ledger-accounts");
    expect(hrefs).toContain("/finance/posting-mappings");
    expect(hrefs).toContain("/finance/journal-entries");
    expect(hrefs).toContain("/finance/accounting-reports");
    // No locked card when DoubleEntry.
    expect(container.querySelector(".cursor-not-allowed")).toBeNull();
  });
});

describe("FinanceSettingsPage — backfill panel (isDoubleEntry && canWriteFinance) (AC-3)", () => {
  it("is hidden when SimpleCash even for a write user", async () => {
    wireProfile(PROFILE_SIMPLE_CASH);
    render(<FinanceSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("title")).toBeInTheDocument();
    });
    expect(
      screen.queryByText("settingsHub.backfillTitle")
    ).not.toBeInTheDocument();
  });

  it("is hidden for a read-only user even when DoubleEntry", async () => {
    authState.canWriteFinance = false;
    wireProfile(PROFILE_DOUBLE_ENTRY);
    render(<FinanceSettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByText("settingsHub.doubleEntryActive")
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByText("settingsHub.backfillTitle")
    ).not.toBeInTheDocument();
  });

  it("is shown for a write user when DoubleEntry and POSTs /backfill-double-entry", async () => {
    wireProfile(PROFILE_DOUBLE_ENTRY);
    apiPost.mockResolvedValue({
      data: {
        transactionsProcessed: 3,
        paymentsProcessed: 2,
        journalEntriesCreated: 5,
        skippedAlreadyPosted: 1,
        errorCount: 0,
        errors: [],
        cutOffDate: "2026-01-01",
        executedAt: "2026-06-12T00:00:00Z",
      },
      error: null,
      status: 200,
    });
    render(<FinanceSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("settingsHub.backfillTitle")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("settingsHub.backfillButton"));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/backfill-double-entry",
        { cutOffDate: undefined }
      );
    });
    // Success summary renders the created count.
    await waitFor(() => {
      expect(
        screen.getByText("settingsHub.backfillSuccess")
      ).toBeInTheDocument();
    });
  });

  it("sends the chosen cut-off date in the backfill body", async () => {
    wireProfile(PROFILE_DOUBLE_ENTRY);
    const { container } = render(<FinanceSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("settingsHub.backfillTitle")).toBeInTheDocument();
    });
    const dateInput = container.querySelector(
      'input[type="date"]'
    ) as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2026-03-01" } });
    fireEvent.click(screen.getByText("settingsHub.backfillButton"));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/backfill-double-entry",
        { cutOffDate: "2026-03-01" }
      );
    });
  });

  it("surfaces the backfill error on res.error", async () => {
    wireProfile(PROFILE_DOUBLE_ENTRY);
    apiPost.mockResolvedValue({ data: null, error: "boom", status: 500 });
    render(<FinanceSettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByText("settingsHub.backfillButton")
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("settingsHub.backfillButton"));

    // The thrown error message is the raw res.error string.
    await waitFor(() => {
      expect(screen.getByText("boom")).toBeInTheDocument();
    });
  });
});

describe("FinanceSettingsPage — danger-zone reset (canWriteFinance) (AC-3/AC-5)", () => {
  it("hides the danger zone for a read-only user", async () => {
    authState.canWriteFinance = false;
    render(<FinanceSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("title")).toBeInTheDocument();
    });
    expect(
      screen.queryByText("settingsHub.dangerZoneTitle")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("settingsHub.resetFinanceButton")
    ).not.toBeInTheDocument();
  });

  it("shows the danger zone with a red reset button for a write user", async () => {
    render(<FinanceSettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByText("settingsHub.dangerZoneTitle")
      ).toBeInTheDocument();
    });
    const resetBtn = screen.getByText("settingsHub.resetFinanceButton");
    // A86: destructive colour preserved — bg-red-600.
    expect(resetBtn.className).toContain("bg-red-600");
  });

  it("opens the confirm modal; reset is gated until the confirm word is typed", async () => {
    render(<FinanceSettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByText("settingsHub.resetFinanceButton")
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("settingsHub.resetFinanceButton"));

    // Modal open: confirm button disabled until the typed word matches the i18n key value.
    const confirmBtn = screen.getByText(
      "settingsHub.resetFinanceConfirmButton"
    ) as HTMLButtonElement;
    expect(confirmBtn).toBeDisabled();
    expect(apiDelete).not.toHaveBeenCalled();

    // Type the wrong word → still disabled, no DELETE.
    const input = screen.getByPlaceholderText(
      "settingsHub.resetFinanceConfirmWord"
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "nope" } });
    fireEvent.click(confirmBtn);
    expect(apiDelete).not.toHaveBeenCalled();
  });

  it("DELETEs /reset and dispatches finance-profile-changed once the confirm word matches", async () => {
    const eventSpy = vi.fn();
    window.addEventListener("finance-profile-changed", eventSpy);
    try {
      apiDelete.mockResolvedValue({ data: null, error: null, status: 200 });
      render(<FinanceSettingsPage />);

      await waitFor(() => {
        expect(
          screen.getByText("settingsHub.resetFinanceButton")
        ).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("settingsHub.resetFinanceButton"));

      const input = screen.getByPlaceholderText(
        "settingsHub.resetFinanceConfirmWord"
      ) as HTMLInputElement;
      // The confirm word equals the i18n key (translator returns the key).
      fireEvent.change(input, {
        target: { value: "settingsHub.resetFinanceConfirmWord" },
      });
      fireEvent.click(
        screen.getByText("settingsHub.resetFinanceConfirmButton")
      );

      await waitFor(() => {
        expect(apiDelete).toHaveBeenCalledWith("/api/v1/finance/reset");
      });
      await waitFor(() => {
        expect(eventSpy).toHaveBeenCalled();
      });
      // Success banner renders.
      expect(
        screen.getByText("settingsHub.resetFinanceSuccess")
      ).toBeInTheDocument();
    } finally {
      window.removeEventListener("finance-profile-changed", eventSpy);
    }
  });

  it("shows the reset error and does NOT dispatch the event on res.error", async () => {
    const eventSpy = vi.fn();
    window.addEventListener("finance-profile-changed", eventSpy);
    try {
      apiDelete.mockResolvedValue({ data: null, error: "boom", status: 500 });
      render(<FinanceSettingsPage />);

      await waitFor(() => {
        expect(
          screen.getByText("settingsHub.resetFinanceButton")
        ).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("settingsHub.resetFinanceButton"));
      const input = screen.getByPlaceholderText(
        "settingsHub.resetFinanceConfirmWord"
      ) as HTMLInputElement;
      fireEvent.change(input, {
        target: { value: "settingsHub.resetFinanceConfirmWord" },
      });
      fireEvent.click(
        screen.getByText("settingsHub.resetFinanceConfirmButton")
      );

      await waitFor(() => {
        expect(apiDelete).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(
          screen.getByText("settingsHub.resetFinanceError")
        ).toBeInTheDocument();
      });
      expect(eventSpy).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("finance-profile-changed", eventSpy);
    }
  });
});
