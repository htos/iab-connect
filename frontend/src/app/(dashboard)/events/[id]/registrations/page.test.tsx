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
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// E24-S1 characterization tests (regression net) for the event-registrations god-page
// (REQ-021), preserved through the E24-S3 feature-slice extraction. Pins ACTUAL behaviour:
// auth/role gating, the pageSize=20 load, filter + search resetting the page to 1, the 7 stat
// cards, per-status action buttons firing their endpoints, PDF/CSV export endpoints,
// promoteFromWaitlist, and the loadFailed surface.
//
// TRANSPORT ADAPTATION (E24-S3): the page now calls the events slice api
// (`event-registrations-api`, built on `useApiClient`) instead of `@/lib/services/events`.
// So the mock changed from spying on service functions to a stable `useApiClient` spy
// ({ get, post, put, delete, upload }), and the assertions changed from
// `service.fn(eventId, regId)` to `apiClient.get/post(byte-identical-endpoint)`. Every
// BEHAVIOURAL assertion (what renders, page-reset, which action fires, loadFailed) is
// preserved verbatim. The endpoints are byte-identical to the service URLs (service prefixed
// `/api/v1`; slice EVENTS_BASE is `/api/v1/events`). DO NOT change behaviour.

// React 19's `use(promise)` Suspends on first render; drive it synchronously.
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

import RegistrationsPage from "./page";

// next-intl: identity translations (echo key). STABLE reference — `t` is in loadData's deps.
vi.mock("next-intl", () => {
  const translate = (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key;
  return { useTranslations: () => translate };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

// useAuth STABLE mutable object — canManage = isVorstand || isAdmin. useApiClient returns a
// stable spy client so the slice api's GET/POST endpoints can be asserted.
const authState = {
  isAuthenticated: true,
  isLoading: false,
  user: null as unknown,
  roles: ["vorstand"] as string[],
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
};

// --- Fixtures -------------------------------------------------------------
const pendingReg = {
  id: "reg-pending",
  eventId: "evt-1",
  participantName: "Pat Pending",
  participantEmail: "pat@example.com",
  participantPhone: null,
  numberOfGuests: 0,
  status: "Pending",
  isWaitlisted: false,
  registeredAt: "2026-06-06T10:00:00Z",
  qrCodeToken: "tp",
  isActive: true,
  isCheckedIn: false,
  paymentStatus: "None",
  amountDue: null,
  currency: null,
};
const confirmedReg = {
  ...pendingReg,
  id: "reg-confirmed",
  participantName: "Cara Confirmed",
  participantEmail: "cara@example.com",
  status: "Confirmed",
  qrCodeToken: "tc",
};

const stats = {
  totalRegistrations: 12,
  confirmedCount: 5,
  pendingCount: 3,
  waitlistedCount: 2,
  cancelledCount: 1,
  checkedInCount: 1,
  noShowCount: 0,
  totalParticipants: 12,
  totalGuests: 0,
};

const pagedData = {
  items: [pendingReg, confirmedReg],
  totalCount: 2,
  page: 1,
  pageSize: 20,
  totalPages: 1,
};

// Endpoint constants (byte-identical to the former service URLs).
const REGS = "/api/v1/events/evt-1/registrations";
const STATS = "/api/v1/events/evt-1/registrations/statistics";
const EVENT = "/api/v1/events/evt-1";
const PDF = "/api/v1/events/evt-1/registrations/export-pdf";
const CSV = "/api/v1/reports/export/events/evt-1/registrations";

// Stable spy client. `get` routes by endpoint: the event/stats/exports return their fixtures;
// any `.../registrations?...` URL returns the paged list. Tests can override per-call.
let regsResponse: unknown;
const apiGet = vi.fn((endpoint: string) => {
  if (endpoint === EVENT)
    return Promise.resolve({
      data: { id: "evt-1", title: "Annual Gala" },
      error: null,
    });
  if (endpoint === STATS) return Promise.resolve({ data: stats, error: null });
  if (endpoint === PDF || endpoint === CSV)
    return Promise.resolve({ data: new Blob(["x"]), error: null });
  // registrations list (with or without a query string)
  if (endpoint.startsWith(REGS)) return Promise.resolve(regsResponse);
  return Promise.resolve({ data: null, error: null });
});
const apiPost = vi.fn(() =>
  Promise.resolve({ data: { ...pendingReg, status: "Confirmed" }, error: null })
);
const apiClient = {
  get: apiGet,
  post: apiPost,
  put: vi.fn(),
  delete: vi.fn(),
  upload: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => apiClient,
}));

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
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.isAdmin = false;
  authState.isVorstand = true;
  regsResponse = { data: pagedData, error: null };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("RegistrationsPage — auth / role gating", () => {
  it("does not load data when not authenticated", async () => {
    // Quirk: when unauthenticated the effect redirects to /login and never clears `loading`,
    // so the page stays on the loading skeleton. Pin the observable outcome: no fetch.
    authState.isAuthenticated = false;
    const { container } = renderPage();
    await waitFor(() => {
      expect(container.querySelector(".animate-pulse")).toBeTruthy();
    });
    expect(
      apiGet.mock.calls.some(([url]) => String(url).startsWith(REGS))
    ).toBe(false);
  });

  it("renders nothing for an authenticated user without manage rights", async () => {
    authState.isVorstand = false;
    authState.isAdmin = false;
    const { container } = renderPage();
    // loadData still runs (the gate is render-time), but the page returns null.
    await waitFor(() => {
      expect(
        apiGet.mock.calls.some(([url]) => String(url).startsWith(REGS))
      ).toBe(true);
    });
    expect(container.querySelector("main")).toBeNull();
  });
});

describe("RegistrationsPage — load + render", () => {
  it("loads with pageSize=20 and renders rows + the 7 stat cards", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Pat Pending")).toBeInTheDocument();
    });
    // pageSize=20 + page=1 in the registrations query string (byte-identical to the god-page).
    expect(
      apiGet.mock.calls.some(([url]) => {
        const s = String(url);
        return (
          s.startsWith(REGS) &&
          s.includes("page=1") &&
          s.includes("pageSize=20")
        );
      })
    ).toBe(true);
    // Stat cards render (7-card grid). "total" is unique to the stat card; "waitlisted" /
    // "noShow" also appear as filter <option>s, so assert presence via getAllByText.
    expect(screen.getByText("12")).toBeInTheDocument(); // total
    expect(screen.getByText("registration.total")).toBeInTheDocument();
    expect(
      screen.getAllByText("registration.waitlisted").length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("registration.noShow").length).toBeGreaterThan(
      0
    );
  });

  it("surfaces loadFailed when the loaders throw", async () => {
    regsResponse = Promise.reject(new Error("network"));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("registration.loadFailed")).toBeInTheDocument();
    });
  });
});

describe("RegistrationsPage — filters", () => {
  it("reloads with status filter and resets the page to 1", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Pat Pending")).toBeInTheDocument()
    );
    apiGet.mockClear();

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Confirmed" },
    });
    await waitFor(() => {
      expect(
        apiGet.mock.calls.some(([url]) => {
          const s = String(url);
          return (
            s.startsWith(REGS) &&
            s.includes("status=Confirmed") &&
            s.includes("page=1") &&
            s.includes("pageSize=20")
          );
        })
      ).toBe(true);
    });
  });

  it("reloads with the search term and resets the page to 1", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Pat Pending")).toBeInTheDocument()
    );
    apiGet.mockClear();

    fireEvent.change(
      screen.getByPlaceholderText("registration.searchParticipant"),
      { target: { value: "cara" } }
    );
    await waitFor(() => {
      expect(
        apiGet.mock.calls.some(([url]) => {
          const s = String(url);
          return (
            s.startsWith(REGS) &&
            s.includes("searchTerm=cara") &&
            s.includes("page=1")
          );
        })
      ).toBe(true);
    });
  });
});

describe("RegistrationsPage — status actions", () => {
  it("fires the confirm endpoint for a Pending row", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Pat Pending")).toBeInTheDocument()
    );
    fireEvent.click(
      screen.getByRole("button", { name: "registration.confirm" })
    );
    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/events/evt-1/registrations/reg-pending/confirm",
        {}
      );
    });
  });

  it("fires the check-in endpoint for a Confirmed row", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Cara Confirmed")).toBeInTheDocument()
    );
    fireEvent.click(
      screen.getByRole("button", { name: "registration.checkIn" })
    );
    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/events/evt-1/registrations/reg-confirmed/check-in",
        {}
      );
    });
  });

  it("fires the no-show endpoint for a Confirmed row", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Cara Confirmed")).toBeInTheDocument()
    );
    fireEvent.click(
      screen.getByRole("button", { name: "registration.markNoShow" })
    );
    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/events/evt-1/registrations/reg-confirmed/no-show",
        {}
      );
    });
  });
});

describe("RegistrationsPage — exports", () => {
  it("triggers the PDF export endpoint", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Pat Pending")).toBeInTheDocument()
    );
    fireEvent.click(
      screen.getByRole("button", { name: "registration.downloadPdf" })
    );
    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith(PDF);
    });
  });

  it("triggers the CSV export endpoint", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Pat Pending")).toBeInTheDocument()
    );
    fireEvent.click(
      screen.getByRole("button", { name: "registration.exportCsv" })
    );
    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith(CSV);
    });
  });
});

describe("RegistrationsPage — promote from waitlist", () => {
  it("fires the promote endpoint (button shown because waitlistedCount > 0)", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Pat Pending")).toBeInTheDocument()
    );
    fireEvent.click(
      screen.getByRole("button", { name: "registration.promoteNext" })
    );
    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/events/evt-1/registrations/promote-from-waitlist",
        {}
      );
    });
  });
});
