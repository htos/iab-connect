// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// REQ-022 (E4-S3) AC-1/AC-3: public registration page renders applicable fee categories
// (single → shown; multiple → radios) and a free event shows no fee section.

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "evt-1" }),
}));

// Stable translator — the page keeps `t` in its data-load useEffect deps.
vi.mock("next-intl", () => {
  const translate = (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key;
  return { useTranslations: () => translate };
});

import PublicEventDetailPage from "./page";

const baseEvent = {
  id: "evt-1",
  title: "Paid Workshop",
  description: "A workshop",
  location: "Hall",
  startDate: "2099-01-01T10:00:00Z",
  endDate: "2099-01-01T12:00:00Z",
  isAllDay: false,
  registrationRequired: true,
  waitlistEnabled: false,
  visibility: "Public",
  status: "Published",
  category: "Workshop",
  tags: [] as string[],
  isFree: false,
  cost: 25,
  hasStarted: false,
  hasEnded: false,
  isRegistrationOpen: true,
};

function mockFetch(fees: unknown[]) {
  global.fetch = vi.fn((url: string | URL | Request) => {
    const u = String(url);
    if (u.endsWith("/fee-categories")) {
      return Promise.resolve({ ok: true, json: async () => fees } as Response);
    }
    return Promise.resolve({
      ok: true,
      json: async () => baseEvent,
    } as Response);
  }) as unknown as typeof fetch;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PublicEventDetailPage fee rendering", () => {
  it("renders a single applicable fee category", async () => {
    mockFetch([{ id: "f1", name: "Adult", amount: 25, currency: "CHF" }]);
    render(<PublicEventDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("fee.sectionTitle")).toBeInTheDocument();
    });
    expect(screen.getByText(/Adult/)).toBeInTheDocument();
    // single fee → no radio inputs
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("renders radios when multiple fee categories apply", async () => {
    mockFetch([
      { id: "f1", name: "Adult", amount: 25, currency: "CHF" },
      { id: "f2", name: "Child", amount: 10, currency: "CHF" },
    ]);
    render(<PublicEventDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("fee.sectionTitle")).toBeInTheDocument();
    });
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByText(/Adult/)).toBeInTheDocument();
    expect(screen.getByText(/Child/)).toBeInTheDocument();
  });

  it("shows no fee section for a free event (no applicable categories)", async () => {
    mockFetch([]);
    render(<PublicEventDetailPage />);

    // Wait until the registration form heading appears, then assert no fee section.
    await waitFor(() => {
      expect(screen.getByText("registration")).toBeInTheDocument();
    });
    expect(screen.queryByText("fee.sectionTitle")).not.toBeInTheDocument();
  });
});
