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
import React from "react";

// REQ-022 (E4-S1) AC-9: cover the fee-category management surface — list rendering, empty
// state, the create dialog + zod validation, a successful create, and deactivate.

// React 19's `use(promise)` Suspends on first render; drive it synchronously like the check-in
// page test does.
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof React>("react");
  return {
    ...actual,
    use: (input: unknown) => {
      const maybeThenable = input as {
        then?: (cb: (v: unknown) => void) => void;
      };
      if (maybeThenable && typeof maybeThenable.then === "function") {
        let resolved: unknown;
        let didResolve = false;
        maybeThenable.then((v) => {
          resolved = v;
          didResolve = true;
        });
        if (didResolve) return resolved;
        throw input;
      }
      return (actual.use as unknown as (x: unknown) => unknown)(input);
    },
  };
});

function syncThenable<T>(value: T): Promise<T> {
  return { then: (cb: (v: T) => void) => cb(value) } as unknown as Promise<T>;
}

import EventFeesPage from "./page";
import * as eventsService from "@/lib/services/events";

// next-intl: identity translations (echo key, append vars JSON when present). The translator
// must be a STABLE reference — the page keeps `t` in its data-load useEffect deps, so a fresh
// function per render would re-fire the effect forever and the dialog would never settle.
vi.mock("next-intl", () => {
  const translate = (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key;
  return { useTranslations: () => translate };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: null,
    roles: ["vorstand"],
    isAdmin: false,
    isVorstand: true,
    isKassier: false,
    isAuditor: false,
    isMember: true,
    hasRole: () => false,
    hasAnyRole: () => false,
    hasAllRoles: () => false,
    canReadFinance: false,
    canWriteFinance: false,
  }),
}));

// Render the Radix dialog as a plain passthrough so the form is in the DOM without portal /
// focus-trap complexity.
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/lib/services/events", async () => {
  const actual = await vi.importActual<typeof eventsService>(
    "@/lib/services/events"
  );
  return {
    ...actual,
    getEventFeeCategories: vi.fn(),
    createEventFeeCategory: vi.fn(),
    updateEventFeeCategory: vi.fn(),
    deactivateEventFeeCategory: vi.fn(),
  };
});

const adultCategory: eventsService.EventFeeCategoryDto = {
  id: "cat-adult",
  eventId: "evt-1",
  name: "Adult",
  description: null,
  amount: 25,
  currency: "CHF",
  applicability: "Everyone",
  availableFrom: null,
  availableUntil: null,
  maxQuantity: null,
  isActive: true,
  createdAt: "2026-06-06T10:00:00Z",
};

const retiredCategory: eventsService.EventFeeCategoryDto = {
  ...adultCategory,
  id: "cat-old",
  name: "Early-bird",
  amount: 15,
  isActive: false,
};

async function renderPage() {
  const params = syncThenable({ id: "evt-1" });
  return render(<EventFeesPage params={params} />);
}

beforeEach(() => {
  vi.mocked(eventsService.getEventFeeCategories).mockResolvedValue({
    data: [adultCategory, retiredCategory],
    error: undefined,
  } as never);
  vi.mocked(eventsService.createEventFeeCategory).mockResolvedValue({
    data: { ...adultCategory, id: "cat-new", name: "Child" },
    error: undefined,
  } as never);
  vi.mocked(eventsService.deactivateEventFeeCategory).mockResolvedValue({
    data: { ...adultCategory, isActive: false },
    error: undefined,
  } as never);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("EventFeesPage", () => {
  it("renders active and retired fee categories", async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Adult")).toBeInTheDocument();
    });
    // Retired category still listed, marked retired.
    expect(screen.getByText("Early-bird")).toBeInTheDocument();
    expect(screen.getByText("retired")).toBeInTheDocument();
  });

  it("shows the empty state when there are no categories", async () => {
    vi.mocked(eventsService.getEventFeeCategories).mockResolvedValue({
      data: [],
      error: undefined,
    } as never);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("noCategories")).toBeInTheDocument();
    });
  });

  it("opens the create dialog and validates a missing name", async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText("Adult")).toBeInTheDocument());

    // Header create button.
    fireEvent.click(screen.getByRole("button", { name: "newCategory" }));
    // Dialog form fields present.
    const nameInput = document.querySelector(
      'input[name="name"]'
    ) as HTMLInputElement;
    expect(nameInput).toBeTruthy();

    // Submit without a name → zod nameRequired surfaces.
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    await waitFor(() => {
      expect(screen.getByText("validation.nameRequired")).toBeInTheDocument();
    });
    expect(eventsService.createEventFeeCategory).not.toHaveBeenCalled();
  });

  it("creates a fee category when the form is valid", async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText("Adult")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "newCategory" }));
    const nameInput = document.querySelector(
      'input[name="name"]'
    ) as HTMLInputElement;
    const amountInput = document.querySelector(
      'input[name="amount"]'
    ) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Child" } });
    fireEvent.change(amountInput, { target: { value: "10" } });

    fireEvent.click(screen.getByRole("button", { name: "save" }));
    await waitFor(() => {
      expect(eventsService.createEventFeeCategory).toHaveBeenCalledWith(
        "evt-1",
        expect.objectContaining({ name: "Child", amount: 10, currency: "CHF" })
      );
    });
  });

  it("deactivates a category after confirmation", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    await renderPage();
    await waitFor(() => expect(screen.getByText("Adult")).toBeInTheDocument());

    // The active row exposes a deactivate action.
    fireEvent.click(screen.getByRole("button", { name: "deactivate" }));
    await waitFor(() => {
      expect(eventsService.deactivateEventFeeCategory).toHaveBeenCalledWith(
        "evt-1",
        "cat-adult"
      );
    });
    confirmSpy.mockRestore();
  });
});
