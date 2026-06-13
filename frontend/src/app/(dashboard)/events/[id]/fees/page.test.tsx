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
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// REQ-022 (E4-S1) AC-9 + E24-S3: cover the fee-category management surface —
// list rendering, empty state, the create dialog + zod validation, a successful
// create, and deactivate.
//
// E24-S3 transport adaptation: the page now renders the `@/features/events`
// `EventFeesContent`, which uses `useApiClient()` ({data,error,status}) +
// TanStack Query instead of the `events` service fns. The
// BEHAVIOURAL assertions from the S1 characterization suite are preserved
// verbatim; only the transport MECHANISM changes:
//   - `getEventFeeCategories(eventId)` → `apiClient.get(endpoint)`.
//   - `createEventFeeCategory(eventId, body)` → `apiClient.post(endpoint, body)`.
//   - `deactivateEventFeeCategory(eventId, catId)` → `apiClient.post(endpoint, {})`
//     (the soft-retire endpoint is POST, not DELETE).
// Mocked hooks/clients return STABLE references so query keys / effect deps do
// not churn (A64/A78); the translator stays a stable identity for the same
// reason the S1 suite noted.

// React 19's `use(promise)` Suspends on first render; drive it synchronously
// like the check-in page test does.
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
import type { EventFeeCategoryDto } from "@/features/events/types/events.types";

// next-intl: identity translations (echo key, append vars JSON when present).
// The translator must be a STABLE reference — the slice keeps `t` in query/effect
// deps, so a fresh function per render would re-fire effects forever.
vi.mock("next-intl", () => {
  const translate = (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key;
  return { useTranslations: () => translate };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

// @/lib/auth: STABLE auth state (vorstand can-manage) + a STABLE, spyable api
// client whose return shape {data,error,status} matches lib/auth.ts.
const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPut = vi.fn();
const apiDelete = vi.fn();
const apiClient = {
  get: apiGet,
  post: apiPost,
  put: apiPut,
  delete: apiDelete,
  upload: vi.fn(),
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: null,
    accessToken: "test-token",
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
  useApiClient: () => apiClient,
}));

// Render the Radix dialog as a plain passthrough so the form is in the DOM
// without portal / focus-trap complexity.
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

const adultCategory: EventFeeCategoryDto = {
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

const retiredCategory: EventFeeCategoryDto = {
  ...adultCategory,
  id: "cat-old",
  name: "Early-bird",
  amount: 15,
  isActive: false,
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const params = syncThenable({ id: "evt-1" });
  return render(
    <QueryClientProvider client={queryClient}>
      <EventFeesPage params={params} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  // List GET — the slice drives the table off this.
  apiGet.mockResolvedValue({
    data: [adultCategory, retiredCategory],
    error: undefined,
    status: 200,
  });
  // Create POST returns the new DTO.
  apiPost.mockResolvedValue({
    data: { ...adultCategory, id: "cat-new", name: "Child" },
    error: undefined,
    status: 200,
  });
  apiPut.mockResolvedValue({
    data: adultCategory,
    error: undefined,
    status: 200,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("EventFeesPage", () => {
  it("renders active and retired fee categories", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Adult")).toBeInTheDocument();
    });
    // Retired category still listed, marked retired.
    expect(screen.getByText("Early-bird")).toBeInTheDocument();
    expect(screen.getByText("retired")).toBeInTheDocument();
  });

  it("shows the empty state when there are no categories", async () => {
    apiGet.mockResolvedValue({ data: [], error: undefined, status: 200 });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("noCategories")).toBeInTheDocument();
    });
  });

  it("opens the create dialog and validates a missing name", async () => {
    renderPage();
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
    // The create POST must not have fired (validation blocked it).
    expect(apiPost).not.toHaveBeenCalled();
  });

  it("creates a fee category when the form is valid", async () => {
    renderPage();
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
    // Transport: create now POSTs the byte-identical endpoint + body.
    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/events/evt-1/fee-categories/",
        expect.objectContaining({ name: "Child", amount: 10, currency: "CHF" })
      );
    });
  });

  it("deactivates a category after confirmation", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();
    await waitFor(() => expect(screen.getByText("Adult")).toBeInTheDocument());

    // The active row exposes a deactivate action.
    fireEvent.click(screen.getByRole("button", { name: "deactivate" }));
    // Transport: deactivate is a POST to the soft-retire endpoint with `{}`.
    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/events/evt-1/fee-categories/cat-adult/deactivate",
        {}
      );
    });
    confirmSpy.mockRestore();
  });
});
