// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// REQ-022 (E4-S3) AC-4: admin roster shows a payment-status badge column + payment stat cards
// derived from the linked-invoice payment status. Preserved through the E24-S3 slice extraction.
//
// TRANSPORT ADAPTATION (E24-S3): the page now reads through the events slice api
// (`useApiClient`) instead of `events`, so the mock is a stable `useApiClient`
// spy routed by endpoint. The behavioural assertions (payment badges + payment stat cards) are
// preserved verbatim.

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

const REGS = "/api/v1/events/evt-1/registrations";
const STATS = "/api/v1/events/evt-1/registrations/statistics";
const EVENT = "/api/v1/events/evt-1";

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

const apiGet = vi.fn((endpoint: string) => {
  if (endpoint === EVENT)
    return Promise.resolve({
      data: { id: "evt-1", title: "Paid Event" },
      error: null,
    });
  if (endpoint === STATS)
    return Promise.resolve({
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
      error: null,
    });
  if (endpoint.startsWith(REGS))
    return Promise.resolve({
      data: {
        items: [paidReg, pendingReg],
        totalCount: 2,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      },
      error: null,
    });
  return Promise.resolve({ data: null, error: null });
});
const apiClient = {
  get: apiGet,
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  upload: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    isVorstand: true,
    isAdmin: false,
  }),
  useApiClient: () => apiClient,
}));

import RegistrationsPage from "./page";

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <RegistrationsPage params={syncThenable({ id: "evt-1" })} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  // fixtures provided by the apiGet router above
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("RegistrationsPage payment column", () => {
  it("renders payment badges and payment stat cards", async () => {
    renderPage();

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
