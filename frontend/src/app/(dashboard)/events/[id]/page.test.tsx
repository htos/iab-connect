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

// REQ-019 (E24-S1 net / E24-S2 transport adaptation) AC 2,3,6,9: characterization net for the
// Event Detail page, now sitting over the EXTRACTED slice (`features/events/components/
// event-detail.tsx`). Pins role-gated action bar, the load-error views, the mutation flows, and
// one registration- + one waitlist-path outcome.
//
// TRANSPORT ADAPTATION (E24-S2, DEC-2): the EVENT itself + publish / unpublish / cancel / delete
// moved off the RAW global `fetch` onto the slice hooks (`useEvent` / `useEventDetailMutations`)
// which use `useApiClient`. So those assertions now drive a STABLE `useApiClient` spy
// (`apiGet`/`apiPost`/`apiDelete`) instead of a `fetch` stub, asserting `apiClient.get/post/delete`
// were called with the byte-identical endpoint (no `${BASE_URL}` prefix — the client owns that).
//
// SEAM-CLOSE (E24-S3): the registration / waitlist surface ALSO moved off `@/lib/services/events`
// onto the slice `event-registrations-api` (still via the SAME `useApiClient` spy, byte-identical
// endpoints: GET `/api/v1/my-registrations`, POST `/api/v1/events/{id}/registrations`, the stats /
// waitlist GETs, `.../promote-from-waitlist`, `.../{regId}/cancel`). So those assertions now match
// on the `apiGet`/`apiPost` spy by URL instead of on service spies. The `@/lib/services/events`
// mock is RETAINED only for `getEventVolunteerShifts`, which the always-rendered
// `VolunteerSelfSignupSection` still calls (it needs `ApiResult.errorBody.errorCode`).

// React 19's `use(promise)` Suspends on first render; the route entry takes
// `params: Promise<{id}>`, so drive `use` synchronously like the fees / check-in tests do.
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

import EventDetailPage from "./page";
import * as eventsService from "@/lib/services/events";

// next-intl: identity translator (echo key, append vars JSON when present). Must be a STABLE
// reference — a fresh function per render would re-fire load effects.
vi.mock("next-intl", () => {
  const translate = (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key;
  return { useTranslations: () => translate };
});

// Module-scope nav spy so assertions can reach it; useRouter returns a STABLE object.
const push = vi.fn();
const router = { push, replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

// STABLE useApiClient spy (E24-S2, DEC-2): the slice event-CRUD transport. Tests drive the event
// GET via `apiGet` and the publish/unpublish/cancel/delete mutations via `apiPost`/`apiDelete`.
const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPut = vi.fn();
const apiDelete = vi.fn();
const apiUpload = vi.fn();
const apiClient = {
  get: apiGet,
  post: apiPost,
  put: apiPut,
  delete: apiDelete,
  upload: apiUpload,
};

// STABLE mutable auth object — tests flip fields before render. canManageEvents =
// isVorstand||isAdmin; canDeleteEvents = isAdmin.
const auth = {
  isAuthenticated: true,
  isLoading: false,
  accessToken: "test-token",
  user: null,
  roles: ["member"] as string[],
  isAdmin: false,
  isVorstand: false,
  isKassier: false,
  isAuditor: false,
  isMember: true,
  hasRole: () => false,
  hasAnyRole: () => false,
  hasAllRoles: () => false,
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => auth,
  useApiClient: () => apiClient,
}));

// Dialog passthrough (the page also has hand-rolled fixed-overlay dialogs, but mock the shared
// component for consistency with the harness contract).
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

// E24-S3 seam-close: the registration / waitlist surface moved onto the slice `useApiClient`
// transport (asserted via the apiGet/apiPost spy below). The `@/lib/services/events` mock is now
// RETAINED ONLY for `getEventVolunteerShifts`, which the always-rendered VolunteerSelfSignupSection
// still calls on mount (it relies on `ApiResult.errorBody.errorCode`, which `useApiClient` can't
// express). Keep it inert so that section doesn't interfere with the detail-page assertions.
vi.mock("@/lib/services/events", async () => {
  const actual = await vi.importActual<typeof eventsService>(
    "@/lib/services/events"
  );
  return {
    ...actual,
    getEventVolunteerShifts: vi.fn(),
  };
});

const publishedEvent: Record<string, unknown> = {
  id: "evt-1",
  title: "Annual Gala",
  description: "A nice evening.",
  location: "Bern",
  startDate: "2026-09-01T18:00:00Z",
  endDate: "2026-09-01T22:00:00Z",
  isAllDay: false,
  registrationRequired: true,
  waitlistEnabled: true,
  visibility: "Public",
  status: "Published",
  category: "Social",
  isFree: true,
  hasStarted: false,
  hasEnded: false,
  isRegistrationOpen: true,
  tags: [],
  createdAt: "2026-06-01T10:00:00Z",
};

function eventWith(overrides: Record<string, unknown>) {
  return { ...publishedEvent, ...overrides };
}

const waitlistEntry: eventsService.EventRegistrationDto = {
  id: "reg-w1",
  eventId: "evt-1",
  participantName: "Wait Lister",
  participantEmail: "wait@example.com",
  numberOfGuests: 0,
  status: "Waitlisted",
  isWaitlisted: true,
  waitlistPosition: 1,
  registeredAt: "2026-06-02T10:00:00Z",
  isNoShow: false,
  qrCodeToken: "tok-w1",
  isActive: true,
  isCheckedIn: false,
};

const stats: eventsService.EventRegistrationStatistics = {
  totalRegistrations: 5,
  confirmedCount: 3,
  pendingCount: 0,
  waitlistedCount: 1,
  cancelledCount: 1,
  checkedInCount: 0,
  noShowCount: 0,
  totalParticipants: 4,
  totalGuests: 0,
};

/**
 * Stub the slice's `useApiClient` for the event GET + publish/unpublish/cancel/delete (E24-S2) AND
 * the registration / waitlist surface (E24-S3 seam-close). All go through the SAME apiGet/apiPost
 * spy, so both route by URL:
 *  - apiGet: `/registrations/statistics` → stats; `/registrations/waitlist` → [waitlistEntry];
 *    `/my-registrations` → [] (override per-test); everything else (the event GET) → eventData.
 *  - apiPost: the event `/publish` `/unpublish` `/cancel` echo a mutated event; the registration
 *    POSTs (`/promote-from-waitlist`, `.../registrations`, `.../{regId}/cancel`) echo a registration.
 * Override per-test as needed. Mirrors the god-page's `defaultFetch` semantics on the new transport.
 */
function defaultApi(eventData: Record<string, unknown> = publishedEvent) {
  apiGet.mockImplementation((url: string) => {
    if (url.endsWith("/registrations/statistics"))
      return Promise.resolve({ data: stats, error: undefined, status: 200 });
    if (url.endsWith("/registrations/waitlist"))
      return Promise.resolve({
        data: [waitlistEntry],
        error: undefined,
        status: 200,
      });
    if (url.endsWith("/my-registrations"))
      return Promise.resolve({ data: [], error: undefined, status: 200 });
    return Promise.resolve({ data: eventData, error: undefined, status: 200 });
  });
  apiPost.mockImplementation((url: string) => {
    if (url.endsWith("/publish"))
      return Promise.resolve({
        data: { ...eventData, status: "Published" },
        error: undefined,
        status: 200,
      });
    if (url.endsWith("/unpublish"))
      return Promise.resolve({
        data: { ...eventData, status: "Draft" },
        error: undefined,
        status: 200,
      });
    if (url.endsWith("/cancel"))
      return Promise.resolve({
        data: { ...eventData, status: "Cancelled" },
        error: undefined,
        status: 200,
      });
    if (url.endsWith("/promote-from-waitlist"))
      return Promise.resolve({
        data: waitlistEntry,
        error: undefined,
        status: 200,
      });
    if (url.endsWith("/registrations"))
      return Promise.resolve({
        data: { ...waitlistEntry, id: "reg-new", isWaitlisted: false },
        error: undefined,
        status: 200,
      });
    return Promise.resolve({ data: eventData, error: undefined, status: 200 });
  });
  apiDelete.mockResolvedValue({
    data: undefined,
    error: undefined,
    status: 200,
  });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <EventDetailPage params={syncThenable({ id: "evt-1" })} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  auth.isAuthenticated = true;
  auth.isLoading = false;
  auth.accessToken = "test-token";
  auth.isAdmin = false;
  auth.isVorstand = false;

  // Seam-close (E24-S3): the registration / waitlist surface is stubbed via the apiGet/apiPost spy
  // in `defaultApi`. Only the volunteer-shift service (still on `@/lib/services/events`) needs a
  // standalone stub so the always-rendered VolunteerSelfSignupSection stays inert.
  vi.mocked(eventsService.getEventVolunteerShifts).mockResolvedValue({
    data: [],
    error: undefined,
  } as never);

  vi.stubGlobal(
    "confirm",
    vi.fn(() => true)
  );
  vi.stubGlobal("alert", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("EventDetailPage — auth gating (AC 2)", () => {
  it("renders the skeleton while auth is loading", () => {
    auth.isLoading = true;
    defaultApi();
    const { container } = renderPage();
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
    // No event fetch fired while auth is still resolving.
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("redirects to /login and renders nothing when unauthenticated", async () => {
    auth.isAuthenticated = false;
    defaultApi();
    renderPage();
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/login");
    });
    expect(apiGet).not.toHaveBeenCalled();
  });
});

describe("EventDetailPage — load-error views (AC 6)", () => {
  it("shows the not-found view on a 404 event GET", async () => {
    apiGet.mockResolvedValue({
      data: undefined,
      error: "not found",
      status: 404,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("errors.notFound")).toBeInTheDocument();
    });
    // Back-to-events link still rendered.
    expect(screen.getByText("actions.backToEvents")).toBeInTheDocument();
  });

  it("shows the generic error view on a non-404 load failure", async () => {
    apiGet.mockResolvedValue({
      data: undefined,
      error: "boom",
      status: 500,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("errors.loadFailed")).toBeInTheDocument();
    });
  });
});

describe("EventDetailPage — action-bar role gating (AC 3)", () => {
  it("hides all manager actions for a plain authenticated member", async () => {
    defaultApi();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("detail.description")).toBeInTheDocument();
    });
    expect(screen.queryByText("actions.edit")).not.toBeInTheDocument();
    expect(screen.queryByText("fees.manageFees")).not.toBeInTheDocument();
    expect(screen.queryByText("actions.unpublish")).not.toBeInTheDocument();
    expect(screen.queryByText("actions.delete")).not.toBeInTheDocument();
  });

  it("shows manager actions (edit, fees, unpublish, cancel) but NOT delete for a vorstand", async () => {
    auth.isVorstand = true;
    defaultApi();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("actions.edit")).toBeInTheDocument();
    });
    expect(screen.getByText("fees.manageFees")).toBeInTheDocument();
    // Published event → unpublish + cancel visible.
    expect(screen.getByText("actions.unpublish")).toBeInTheDocument();
    expect(screen.getByText("actions.cancel")).toBeInTheDocument();
    // Delete is admin-only.
    expect(screen.queryByText("actions.delete")).not.toBeInTheDocument();
  });

  it("shows the delete action for an admin (canDeleteEvents)", async () => {
    auth.isAdmin = true;
    defaultApi();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("actions.delete")).toBeInTheDocument();
    });
  });

  it("shows publish (not unpublish/cancel) for a manager on a Draft event", async () => {
    auth.isVorstand = true;
    defaultApi(eventWith({ status: "Draft" }));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("actions.publish")).toBeInTheDocument();
    });
    expect(screen.queryByText("actions.unpublish")).not.toBeInTheDocument();
    expect(screen.queryByText("actions.cancel")).not.toBeInTheDocument();
  });
});

describe("EventDetailPage — slice apiClient mutations (AC 3)", () => {
  it("fires POST /events/evt-1/publish for a manager on a Draft event", async () => {
    auth.isVorstand = true;
    defaultApi(eventWith({ status: "Draft" }));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("actions.publish")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText("actions.publish"));
    await waitFor(() => {
      const call = apiPost.mock.calls.find(([u]) =>
        String(u).endsWith("/api/v1/events/evt-1/publish")
      );
      expect(call).toBeTruthy();
    });
  });

  it("fires POST /events/evt-1/unpublish for a manager on a Published event", async () => {
    auth.isVorstand = true;
    defaultApi();
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("actions.unpublish")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText("actions.unpublish"));
    await waitFor(() => {
      const call = apiPost.mock.calls.find(([u]) =>
        String(u).endsWith("/api/v1/events/evt-1/unpublish")
      );
      expect(call).toBeTruthy();
    });
  });

  it("fires POST /events/evt-1/cancel from the cancel dialog", async () => {
    auth.isVorstand = true;
    defaultApi();
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("actions.cancel")).toBeInTheDocument()
    );
    // Open the hand-rolled cancel dialog (button in the action bar).
    fireEvent.click(screen.getByText("actions.cancel"));
    // Confirm inside the dialog (the dialog's destructive button reuses actions.cancel label).
    await waitFor(() =>
      expect(screen.getByText("actions.confirmCancelDesc")).toBeInTheDocument()
    );
    const cancelButtons = screen.getAllByText("actions.cancel");
    // The dialog confirm button is the last actions.cancel occurrence.
    fireEvent.click(cancelButtons[cancelButtons.length - 1]);
    await waitFor(() => {
      const call = apiPost.mock.calls.find(([u]) =>
        String(u).endsWith("/api/v1/events/evt-1/cancel")
      );
      expect(call).toBeTruthy();
    });
  });

  it("fires DELETE /events/evt-1 then navigates to /events for an admin", async () => {
    auth.isAdmin = true;
    defaultApi();
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("actions.delete")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText("actions.delete"));
    await waitFor(() =>
      expect(screen.getByText("actions.confirmDeleteDesc")).toBeInTheDocument()
    );
    const deleteButtons = screen.getAllByText("actions.delete");
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);
    await waitFor(() => {
      const call = apiDelete.mock.calls.find(([u]) =>
        String(u).endsWith("/api/v1/events/evt-1")
      );
      expect(call).toBeTruthy();
    });
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/events");
    });
  });
});

describe("EventDetailPage — manager registration stats + waitlist (AC 9)", () => {
  it("loads stats + waitlist and promotes from the waitlist", async () => {
    auth.isVorstand = true;
    defaultApi();
    renderPage();
    // Manager overview panel renders once stats load.
    await waitFor(() => {
      expect(
        screen.getByText("registration.registrationsOverview")
      ).toBeInTheDocument();
    });
    // Stats + waitlist now go through the slice apiClient (byte-identical endpoints).
    expect(
      apiGet.mock.calls.some(([u]) =>
        String(u).endsWith("/api/v1/events/evt-1/registrations/statistics")
      )
    ).toBe(true);
    expect(
      apiGet.mock.calls.some(([u]) =>
        String(u).endsWith("/api/v1/events/evt-1/registrations/waitlist")
      )
    ).toBe(true);

    // Promote-next button appears because the waitlist is non-empty.
    await waitFor(() =>
      expect(screen.getByText("registration.promoteNext")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText("registration.promoteNext"));
    await waitFor(() => {
      const call = apiPost.mock.calls.find(([u]) =>
        String(u).endsWith(
          "/api/v1/events/evt-1/registrations/promote-from-waitlist"
        )
      );
      expect(call).toBeTruthy();
    });
  });

  it("surfaces promoteFailed when promotion rejects", async () => {
    auth.isVorstand = true;
    defaultApi();
    // Override the promote POST to reject (no data) — drives the promoteFailed banner.
    apiPost.mockImplementation((url: string) => {
      if (url.endsWith("/promote-from-waitlist"))
        return Promise.resolve({ data: undefined, error: "nope", status: 409 });
      return Promise.resolve({
        data: publishedEvent,
        error: undefined,
        status: 200,
      });
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("registration.promoteNext")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText("registration.promoteNext"));
    await waitFor(() => {
      expect(
        screen.getByText("registration.promoteFailed")
      ).toBeInTheDocument();
    });
  });
});

describe("EventDetailPage — member registration path (AC 9)", () => {
  it("filters getMyRegistrations to this event and ignores cancelled ones", async () => {
    defaultApi();
    // Override the my-registrations GET: one row for another event, one cancelled here.
    apiGet.mockImplementation((url: string) => {
      if (url.endsWith("/my-registrations"))
        return Promise.resolve({
          data: [
            { ...waitlistEntry, id: "other", eventId: "evt-other" },
            { ...waitlistEntry, id: "cancelled-here", status: "Cancelled" },
          ],
          error: undefined,
          status: 200,
        });
      if (url.endsWith("/registrations/statistics"))
        return Promise.resolve({ data: stats, error: undefined, status: 200 });
      if (url.endsWith("/registrations/waitlist"))
        return Promise.resolve({
          data: [waitlistEntry],
          error: undefined,
          status: 200,
        });
      return Promise.resolve({
        data: publishedEvent,
        error: undefined,
        status: 200,
      });
    });
    renderPage();
    await waitFor(() => {
      expect(
        apiGet.mock.calls.some(([u]) =>
          String(u).endsWith("/api/v1/my-registrations")
        )
      ).toBe(true);
    });
    // None of the rows match (wrong event + cancelled) → registerNow CTA shown.
    await waitFor(() =>
      expect(screen.getByText("registration.registerNow")).toBeInTheDocument()
    );
  });

  it("fires registerForEvent with the entered guest count", async () => {
    defaultApi();
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("registration.registerNow")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText("registration.registerNow"));
    // Reg form: set guest count then submit.
    const guestInput = document.querySelector(
      'input[type="number"]'
    ) as HTMLInputElement;
    expect(guestInput).toBeTruthy();
    fireEvent.change(guestInput, { target: { value: "2" } });
    fireEvent.click(screen.getByText("registration.register"));
    await waitFor(() => {
      const call = apiPost.mock.calls.find(
        ([u, body]) =>
          String(u).endsWith("/api/v1/events/evt-1/registrations") &&
          (body as { numberOfGuests?: number })?.numberOfGuests === 2
      );
      expect(call).toBeTruthy();
    });
  });

  it("surfaces registrationFailed when registration rejects", async () => {
    defaultApi();
    // Override the register POST to reject (no data, no error) → registrationFailed banner.
    apiPost.mockImplementation((url: string) => {
      if (url.endsWith("/registrations"))
        return Promise.resolve({
          data: undefined,
          error: undefined,
          status: 400,
        });
      return Promise.resolve({
        data: publishedEvent,
        error: undefined,
        status: 200,
      });
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("registration.registerNow")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText("registration.registerNow"));
    fireEvent.click(screen.getByText("registration.register"));
    await waitFor(() => {
      expect(
        screen.getByText("registration.registrationFailed")
      ).toBeInTheDocument();
    });
  });
});
