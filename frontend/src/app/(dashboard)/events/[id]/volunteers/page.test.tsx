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

// E24-S3: Behaviour-preserving regression net for the volunteer-management
// sub-page (REQ-024), repointed to the feature-slice transport.
//
// The page now renders `@/features/events` `EventVolunteersContent`, which uses
// `useApiClient()` ({data,error,status}) + TanStack Query instead of the legacy
// `@/lib/services/events` functions + manual `refreshKey` reload. Every
// behavioural assertion from the E24-S1 characterization suite is preserved
// verbatim — ONLY the transport MECHANISM changes:
//   - `getEventVolunteerRoles(id)` / `getEventVolunteerShifts(id)` →
//     `apiClient.get(endpoint)` (parallel load driven per-endpoint via the URL).
//   - `createVolunteerRole(id, body)` → `apiClient.post(endpoint, body)`.
//   - `createVolunteerShift(id, body)` → `apiClient.post(endpoint, body)` (the
//     Zurich→UTC payload is unchanged).
//   - `cancelVolunteerShift(id, shiftId)` → `apiClient.post(cancelEndpoint, ...)`.
// Endpoints are byte-identical to the legacy service (the legacy `apiGet/apiPost`
// helpers prepended `/api/v1`, so `/events/...` → `/api/v1/events/...`).
//
// Mocked hooks/clients return STABLE references (define once, mutate per test)
// so effects/query keys do not churn on identity changes.

const ROLES_URL = "/api/v1/events/evt-1/volunteer-roles/";
const SHIFTS_URL = "/api/v1/events/evt-1/volunteer-shifts/";

// React 19's `use(promise)` Suspends on first render; drive it synchronously
// like the fees page test does. The page takes `params: Promise<{ id }>`.
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

import VolunteersPage from "./page";

// next-intl: identity translations (echo key). Must be a STABLE reference.
vi.mock("next-intl", () => {
  const translate = (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key;
  return { useTranslations: () => translate };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

// @/lib/auth: STABLE auth state (tests flip fields before render) + a STABLE,
// spyable api client whose shape ({data,error,status}) matches the real
// useApiClient. canManage for this page = isVorstand || isAdmin ||
// roles.includes("event-manager").
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
const authState = {
  isAuthenticated: true,
  isLoading: false,
  user: null as unknown,
  roles: ["vorstand"] as string[],
  accessToken: "test-token",
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

vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => apiClient,
}));

// Radix dialog → plain passthrough so the form is in the DOM without
// portal/focus-trap.
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

interface VolunteerRoleDto {
  id: string;
  eventId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

interface VolunteerShiftDto {
  id: string;
  eventId: string;
  roleId: string;
  roleName: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number;
  confirmedCount: number;
  waitlistCount: number;
  allowWaitlist: boolean;
  allowSelfSignup: boolean;
  notes: string | null;
  createdAt: string;
}

const role: VolunteerRoleDto = {
  id: "role-1",
  eventId: "evt-1",
  name: "Setup Crew",
  description: "Builds the stage",
  isActive: true,
  createdAt: "2026-06-06T10:00:00Z",
};

const shift: VolunteerShiftDto = {
  id: "shift-1",
  eventId: "evt-1",
  roleId: "role-1",
  roleName: "Setup Crew",
  title: "Morning Setup",
  description: null,
  // 2026-07-01 08:00 UTC == 10:00 Zurich (CEST, +2).
  startsAt: "2026-07-01T08:00:00Z",
  endsAt: "2026-07-01T10:00:00Z",
  capacity: 5,
  confirmedCount: 2,
  waitlistCount: 1,
  allowWaitlist: true,
  allowSelfSignup: false,
  notes: null,
  createdAt: "2026-06-06T10:00:00Z",
};

// Drive the parallel roles+shifts load by switching on the requested URL.
function defaultGet(url: string) {
  if (url === ROLES_URL) {
    return Promise.resolve({ data: [role], error: null, status: 200 });
  }
  if (url === SHIFTS_URL) {
    return Promise.resolve({ data: [shift], error: null, status: 200 });
  }
  return Promise.resolve({ data: null, error: null, status: 200 });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <VolunteersPage params={syncThenable({ id: "evt-1" })} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.roles = ["vorstand"];
  authState.isAdmin = false;
  authState.isVorstand = true;

  vi.stubGlobal(
    "confirm",
    vi.fn(() => true)
  );

  apiGet.mockImplementation(defaultGet);
  apiPost.mockResolvedValue({
    data: { ...role, id: "role-new", name: "Cleanup" },
    error: null,
    status: 200,
  });
  apiPut.mockResolvedValue({ data: shift, error: null, status: 200 });
  apiDelete.mockResolvedValue({ data: null, error: null, status: 200 });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("VolunteersPage — auth / role gating", () => {
  it("renders nothing when not authenticated", async () => {
    authState.isAuthenticated = false;
    const { container } = renderPage();
    // Not-authenticated → guard short-circuits; no data fetched.
    await waitFor(() => {
      expect(apiGet).not.toHaveBeenCalledWith(ROLES_URL);
    });
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("does not load data for an authenticated out-of-role user", async () => {
    // Quirk: the queries are disabled on !canManage and `loading` stays true,
    // so the page is pinned on the loading skeleton (the permissionDenied
    // branch is effectively unreachable for this state). Pin the observable
    // outcome: no data fetched.
    authState.isVorstand = false;
    authState.isAdmin = false;
    authState.roles = ["member"];
    const { container } = renderPage();
    await waitFor(() => {
      expect(container.querySelector(".animate-pulse")).toBeTruthy();
    });
    expect(apiGet).not.toHaveBeenCalledWith(ROLES_URL);
    expect(screen.queryByText("permissionDenied")).toBeNull();
  });

  it("allows an event-manager (role-based) to manage", async () => {
    authState.isVorstand = false;
    authState.isAdmin = false;
    authState.roles = ["event-manager"];
    renderPage();
    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith(ROLES_URL);
    });
  });
});

describe("VolunteersPage — load + render", () => {
  it("loads roles and shifts in parallel and renders them", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Setup Crew")).toBeInTheDocument();
    });
    expect(apiGet).toHaveBeenCalledWith(ROLES_URL);
    expect(apiGet).toHaveBeenCalledWith(SHIFTS_URL);
    // Shift row rendered under its role.
    expect(screen.getByText("Morning Setup")).toBeInTheDocument();
  });

  it("surfaces loadFailed when a loader returns an error", async () => {
    apiGet.mockImplementation((url: string) => {
      if (url === SHIFTS_URL) {
        return Promise.resolve({ data: null, error: "boom", status: 500 });
      }
      return defaultGet(url);
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("loadFailed")).toBeInTheDocument();
    });
  });
});

describe("VolunteersPage — role create", () => {
  it("fires createVolunteerRole with the trimmed name + description", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Setup Crew")).toBeInTheDocument()
    );

    const nameInput = document.querySelector(
      'section input[type="text"]'
    ) as HTMLInputElement;
    const inputs = document.querySelectorAll(
      'section input[type="text"]'
    ) as NodeListOf<HTMLInputElement>;
    fireEvent.change(nameInput, { target: { value: "  Cleanup  " } });
    fireEvent.change(inputs[1], { target: { value: "  After event  " } });

    // The role-create form's save button is the first "save" button (shift
    // dialog is closed).
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(ROLES_URL, {
        name: "Cleanup",
        description: "After event",
      });
    });
  });
});

describe("VolunteersPage — shift dialog (RHF + zod)", () => {
  async function openShiftDialog() {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Setup Crew")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "newShift" }));
    await waitFor(() =>
      expect(document.querySelector('input[name="title"]')).toBeTruthy()
    );
  }

  // The role-create section also has a "save" button; the dialog's submit is the
  // form's submit button (type="submit"), which the role form's button is not.
  function dialogSaveButton() {
    return document.querySelector(
      'form button[type="submit"]'
    ) as HTMLButtonElement;
  }

  it("validates a missing title (zod) and does not call the service", async () => {
    await openShiftDialog();
    fireEvent.click(dialogSaveButton());
    await waitFor(() => {
      expect(screen.getByText("validation.titleRequired")).toBeInTheDocument();
    });
    // No POST to the shifts collection endpoint (apiPost may carry role-create
    // calls in other tests, but here it must not be hit at all).
    expect(apiPost).not.toHaveBeenCalled();
  });

  it("creates a shift, converting Zurich wall-clock input to a UTC-ISO instant", async () => {
    apiPost.mockResolvedValue({
      data: { ...shift, id: "shift-new" },
      error: null,
      status: 200,
    });
    await openShiftDialog();

    const titleInput = document.querySelector(
      'input[name="title"]'
    ) as HTMLInputElement;
    const startInput = document.querySelector(
      'input[name="startsAt"]'
    ) as HTMLInputElement;
    const endInput = document.querySelector(
      'input[name="endsAt"]'
    ) as HTMLInputElement;
    const capacityInput = document.querySelector(
      'input[name="capacity"]'
    ) as HTMLInputElement;

    fireEvent.change(titleInput, { target: { value: "Evening Teardown" } });
    // 2026-07-01 is CEST (+2). 12:00 Zurich → 10:00:00Z; 14:00 Zurich → 12:00:00Z.
    fireEvent.change(startInput, { target: { value: "2026-07-01T12:00" } });
    fireEvent.change(endInput, { target: { value: "2026-07-01T14:00" } });
    fireEvent.change(capacityInput, { target: { value: "3" } });

    fireEvent.click(dialogSaveButton());
    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        SHIFTS_URL,
        expect.objectContaining({
          roleId: "role-1",
          title: "Evening Teardown",
          capacity: 3,
          startsAt: "2026-07-01T10:00:00.000Z",
          endsAt: "2026-07-01T12:00:00.000Z",
          allowWaitlist: false,
          allowSelfSignup: false,
        })
      );
    });
  });
});

describe("VolunteersPage — cancel shift", () => {
  it("confirms (assignment-aware copy) then calls cancelVolunteerShift", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Morning Setup")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "cancelShift" }));
    // confirmedCount(2) + waitlistCount(1) = 3 → assignment-aware confirm copy.
    expect(window.confirm).toHaveBeenCalledWith(
      `confirmDeleteWithAssignments ${JSON.stringify({ count: 3 })}`
    );
    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/events/evt-1/volunteer-shifts/shift-1/cancel",
        { reason: null }
      );
    });
  });

  it("does not call the service when confirm is declined", async () => {
    vi.stubGlobal(
      "confirm",
      vi.fn(() => false)
    );
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Morning Setup")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "cancelShift" }));
    expect(apiPost).not.toHaveBeenCalled();
  });
});
