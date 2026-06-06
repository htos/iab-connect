// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

// REQ-022 (E4-S3) AC-4: admin roster shows a payment-status badge column + payment stat cards
// derived from the linked-invoice payment status.

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof React>("react");
  return {
    ...actual,
    use: (input: unknown) => {
      const m = input as { then?: (cb: (v: unknown) => void) => void };
      if (m && typeof m.then === "function") {
        let r: unknown;
        let d = false;
        m.then((v) => {
          r = v;
          d = true;
        });
        if (d) return r;
        throw input;
      }
      return (actual.use as unknown as (x: unknown) => unknown)(input);
    },
  };
});

function syncThenable<T>(value: T): Promise<T> {
  return { then: (cb: (v: T) => void) => cb(value) } as unknown as Promise<T>;
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next-intl", () => {
  const translate = (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key;
  return { useTranslations: () => translate };
});

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    isVorstand: true,
    isAdmin: false,
  }),
  useApiClient: () => ({ get: vi.fn() }),
}));

import RegistrationsPage from "./page";
import * as eventsService from "@/lib/services/events";

vi.mock("@/lib/services/events", async () => {
  const actual = await vi.importActual<typeof eventsService>(
    "@/lib/services/events"
  );
  return {
    ...actual,
    getEventById: vi.fn(),
    getEventRegistrations: vi.fn(),
    getEventRegistrationStatistics: vi.fn(),
  };
});

const paidReg = {
  id: "r1",
  eventId: "evt-1",
  participantName: "Anna Paid",
  participantEmail: "anna@example.com",
  numberOfGuests: 1,
  status: "Confirmed",
  isWaitlisted: false,
  registeredAt: "2026-06-06T10:00:00Z",
  qrCodeToken: "t1",
  isActive: true,
  isCheckedIn: false,
  paymentStatus: "Paid",
  amountDue: 25,
  currency: "CHF",
};
const pendingReg = {
  ...paidReg,
  id: "r2",
  participantName: "Bob Pending",
  participantEmail: "bob@example.com",
  qrCodeToken: "t2",
  paymentStatus: "Pending",
  amountDue: 10,
};

beforeEach(() => {
  vi.mocked(eventsService.getEventById).mockResolvedValue({
    data: { id: "evt-1", title: "Paid Event" },
    error: undefined,
  } as never);
  vi.mocked(eventsService.getEventRegistrations).mockResolvedValue({
    data: {
      items: [paidReg, pendingReg],
      totalCount: 2,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    },
    error: undefined,
  } as never);
  vi.mocked(eventsService.getEventRegistrationStatistics).mockResolvedValue({
    data: {
      totalRegistrations: 2,
      confirmedCount: 2,
      pendingCount: 0,
      waitlistedCount: 0,
      cancelledCount: 0,
      checkedInCount: 0,
      noShowCount: 0,
      totalParticipants: 2,
      totalGuests: 0,
    },
    error: undefined,
  } as never);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("RegistrationsPage payment column", () => {
  it("renders payment badges and payment stat cards", async () => {
    render(<RegistrationsPage params={syncThenable({ id: "evt-1" })} />);

    await waitFor(() => {
      expect(screen.getByText("Anna Paid")).toBeInTheDocument();
    });
    // Payment column header + badges (translation keys).
    expect(screen.getByText("registration.payment")).toBeInTheDocument();
    expect(
      screen.getAllByText("registration.paymentPaid").length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("registration.paymentPending").length
    ).toBeGreaterThan(0);
    // Payment stat cards.
    expect(screen.getByText("registration.amountPaid")).toBeInTheDocument();
    expect(screen.getByText("registration.amountOwed")).toBeInTheDocument();
  });
});
