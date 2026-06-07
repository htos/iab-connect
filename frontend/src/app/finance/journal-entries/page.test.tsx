// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));

const apiGet = vi.fn();
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ canReadFinance: true, canWriteFinance: true }),
  useApiClient: () => ({
    get: apiGet,
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
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

afterEach(() => {
  cleanup();
  apiGet.mockReset();
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
