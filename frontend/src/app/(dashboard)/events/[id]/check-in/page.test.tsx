// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

/**
 * E24-S3: the E24-S1 check-in characterization suite, repointed to the
 * feature-slice transport. The page now renders the slice
 * `CheckInPageContent`, which calls `useApiClient()` ({data,error,status})
 * instead of the three `@/lib/services/events` fns. EVERY behavioural assertion
 * (the outcome-banner matrix, role gating, camera auto-flip, 250ms debounce +
 * client filter, lastScannedToken dedupe, refreshKey reload-after-success /
 * no-reload-on-failure, scanAgain, actionInFlight, loadRosterFailed) is
 * preserved verbatim. Only the TRANSPORT MECHANISM assertions change:
 *   - `getEventCheckInRoster(eventId,{includeWaitlisted:false})` →
 *      apiClient.get("/api/v1/events/evt-1/registrations/check-in-roster")
 *   - `checkInByQrCode(token)` →
 *      apiClient.post("/api/v1/registrations/check-in/<encoded-token>", {})
 *   - `manualCheckIn(eventId, regId, search)` →
 *      apiClient.post("/api/v1/events/evt-1/registrations/<regId>/manual-check-in",
 *        { searchQuery: search ?? null })
 * Outcomes are driven via apiPost/apiGet `.mockResolvedValue({ data, error, status })`.
 */

// React 19's `use(promise)` Suspends on first render in tests; jsdom timing makes the
// suspension awkward to drive. Override `use()` so the test can pass a synchronous
// thenable that resolves immediately. Production behaviour is unaffected (this mock
// only applies to this test file).
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

// Synchronous "thenable" that lets `use()` extract its value without microtasks.
function syncThenable<T>(value: T): Promise<T> {
  return { then: (cb: (v: T) => void) => cb(value) } as unknown as Promise<T>;
}

import CheckInPage from "./page";

// REQ-023 (E3.S2) AC-7/AC-8: cover scanner/manual state-machine + idempotent banner +
// invalid-QR banner. Live-camera streaming is a manual / Playwright follow-up.

// next-intl: identity translations with token interpolation. The translator is a STABLE
// reference (memoized module-level) so effects that depend on `t` don't re-run on every
// render — production next-intl likewise returns a referentially-stable `t`. This keeps the
// refreshKey-driven roster-reload call counts deterministic.
const stableTranslate = (key: string, vars?: Record<string, unknown>) =>
  vars ? `${key} ${JSON.stringify(vars)}` : key;
vi.mock("next-intl", () => ({
  useTranslations: () => stableTranslate,
}));

// next/navigation: stubbed router
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

// next/dynamic: load the imported module synchronously so the scanner shows in tests.
// The stub also exposes the real component's `onScan`/`onError` callbacks via two hidden
// buttons so QR-decode outcomes can be driven without a live camera. `data-qr` lets a test
// pick the raw value that gets fed to `onScan`. The slice's <CheckInScanner /> keeps the
// SAME `@yudiel/react-qr-scanner` import specifier (DEC-2) so this stub still intercepts it.
interface StubScannerProps {
  onScan?: (detected: { rawValue: string }[]) => void;
  onError?: () => void;
}
vi.mock("next/dynamic", () => ({
  default: (
    loader: () => Promise<{ Scanner: React.ComponentType<unknown> }>
  ) => {
    void loader;
    return function StubScanner({ onScan, onError }: StubScannerProps) {
      return (
        <div data-testid="qr-scanner-stub">
          qr-scanner
          <button
            type="button"
            data-testid="qr-emit"
            onClick={(e) => {
              const raw = (e.currentTarget.getAttribute("data-qr") ??
                "tok-anna") as string;
              onScan?.([{ rawValue: raw }]);
            }}
          >
            emit-scan
          </button>
          <button
            type="button"
            data-testid="qr-error"
            onClick={() => onError?.()}
          >
            emit-error
          </button>
        </div>
      );
    };
  },
}));

// @/lib/auth: minimal in-test useAuth + a STABLE spyable useApiClient (E24-S3
// transport). The auth object is mutable per-test via `authState` so role-gating
// cases can swap in an out-of-role authenticated user without breaking the default
// (vorstand) used by every existing test. `apiGet`/`apiPost` are the transport
// spies the slice hooks call (replacing the three service fns).
const apiGet = vi.fn();
const apiPost = vi.fn();
const apiClient = {
  get: apiGet,
  post: apiPost,
  put: vi.fn(),
  delete: vi.fn(),
  upload: vi.fn(),
};
const defaultAuthState = {
  isAuthenticated: true,
  isLoading: false,
  user: null,
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
let authState = { ...defaultAuthState };
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => apiClient,
}));

// Byte-identical endpoints reproduced from `@/lib/services/events` (the slice
// `useApiClient` prepends nothing; the service `apiGet/apiPost` prepended /api/v1).
const ROSTER_ENDPOINT = "/api/v1/events/evt-1/registrations/check-in-roster";
const manualEndpoint = (regId: string) =>
  `/api/v1/events/evt-1/registrations/${regId}/manual-check-in`;
const qrEndpoint = (token: string) =>
  `/api/v1/registrations/check-in/${encodeURIComponent(token)}`;

const mockedRoster = {
  eventId: "evt-1",
  eventTitle: "Diwali 2026",
  eventStartDate: "2026-11-01T18:00:00Z",
  eventLocation: "Venue",
  generatedAt: "2026-05-13T12:00:00Z",
  totalRegistrations: 2,
  checkedInCount: 0,
  items: [
    {
      registrationId: "reg-anna",
      qrCodeToken: "tok-anna",
      participantName: "Anna Schmidt",
      numberOfGuests: 1,
      status: "Confirmed" as const,
      isWaitlisted: false,
      isCheckedIn: false,
      checkedInAt: null,
      specialRequirements: null,
    },
    {
      registrationId: "reg-bob",
      qrCodeToken: "tok-bob",
      participantName: "Bob Müller",
      numberOfGuests: 2,
      status: "Confirmed" as const,
      isWaitlisted: false,
      isCheckedIn: false,
      checkedInAt: null,
      specialRequirements: null,
    },
  ],
};

function setMediaDevices(mode: "available" | "denied" | "missing") {
  if (mode === "missing") {
    Object.defineProperty(global.navigator, "mediaDevices", {
      value: undefined,
      configurable: true,
    });
    return;
  }
  const getUserMedia =
    mode === "available"
      ? vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] })
      : vi.fn().mockRejectedValue(
          Object.assign(new Error("NotAllowedError"), {
            name: "NotAllowedError",
          })
        );
  Object.defineProperty(global.navigator, "mediaDevices", {
    value: { getUserMedia },
    configurable: true,
  });
}

async function renderPage() {
  // Pass a synchronous thenable so the mocked `use()` returns the id immediately and we
  // skip Suspense altogether.
  const params = syncThenable({ id: "evt-1" });
  return render(<CheckInPage params={params} />);
}

beforeEach(() => {
  authState = { ...defaultAuthState };
  apiGet.mockResolvedValue({
    data: mockedRoster,
    error: null,
    status: 200,
  });
  apiPost.mockResolvedValue({ data: null, error: null, status: 200 });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// A registration DTO is required for the result banner to render at all
// (`result?.registration &&` gates the whole card). Minimal shape only.
function registration(overrides: Record<string, unknown> = {}) {
  return {
    id: "reg-anna",
    participantName: "Anna Schmidt",
    checkedInAt: undefined,
    ...overrides,
  };
}

// Build a `useApiClient` result. Default success carries `data`; pass `status`/`error`
// to drive the failure branches (mirrors the {data,error,status} contract).
function apiResult(
  data: unknown,
  extra: { error?: string | null; status?: number } = {}
) {
  return { data, error: null, status: 200, ...extra } as never;
}

// Drive the stub scanner's `onScan` with a chosen raw token (default tok-anna).
async function emitScan(token = "tok-anna") {
  const emit = await screen.findByTestId("qr-emit");
  emit.setAttribute("data-qr", token);
  fireEvent.click(emit);
}

describe("CheckInPage", () => {
  it("renders the scanner stub when mediaDevices is available", async () => {
    setMediaDevices("available");
    await renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("qr-scanner-stub")).toBeInTheDocument();
    });
  });

  it("flips to manual fallback when getUserMedia rejects with NotAllowedError", async () => {
    setMediaDevices("denied");
    await renderPage();

    // Manual section header (translation key id) appears once camera path is rejected.
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("manual.searchPlaceholder")
      ).toBeInTheDocument();
    });
    expect(screen.queryByTestId("qr-scanner-stub")).not.toBeInTheDocument();
  });

  it("flips to manual when navigator.mediaDevices is undefined", async () => {
    setMediaDevices("missing");
    await renderPage();

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("manual.searchPlaceholder")
      ).toBeInTheDocument();
    });
  });

  it("shows the manual roster names", async () => {
    setMediaDevices("denied");
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText("Anna Schmidt")).toBeInTheDocument();
      expect(screen.getByText("Bob Müller")).toBeInTheDocument();
    });
  });

  // ── Role gating ────────────────────────────────────────────────────────────
  it("shows the forbidden alert for an authenticated out-of-role user", async () => {
    setMediaDevices("available");
    authState = {
      ...defaultAuthState,
      isVorstand: false,
      isAdmin: false,
      isMember: true,
      roles: ["member"],
    };
    await renderPage();

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("forbidden");
    });
    // The roster never loads for a forbidden user (guard short-circuits the effect).
    expect(apiGet).not.toHaveBeenCalled();
    expect(screen.queryByTestId("qr-scanner-stub")).not.toBeInTheDocument();
  });

  it("grants access via the event-manager role", async () => {
    setMediaDevices("available");
    authState = {
      ...defaultAuthState,
      isVorstand: false,
      isAdmin: false,
      roles: ["event-manager"],
    };
    await renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("qr-scanner-stub")).toBeInTheDocument();
    });
    expect(apiGet).toHaveBeenCalledWith(ROSTER_ENDPOINT);
  });

  // ── Tabs + SSR-guarded scanner import ──────────────────────────────────────
  it("renders both scanner and manual tabs", async () => {
    setMediaDevices("available");
    await renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "tabs.scanner" })
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "tabs.manual" })
    ).toBeInTheDocument();
    // The dynamic scanner is mounted via the next/dynamic stub (ssr:false guard intact).
    expect(screen.getByTestId("qr-scanner-stub")).toBeInTheDocument();
  });

  it("disables the scanner tab when the camera is unavailable", async () => {
    setMediaDevices("denied");
    await renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "tabs.scanner" })
      ).toBeDisabled();
    });
  });

  // ── Manual-search debounce + client-side filter ────────────────────────────
  // Uses real timers (the 250ms debounce is short). We assert the pre-debounce state is
  // synchronously unchanged, then wait for the debounced client-side filter to apply.
  it("debounces manual search by 250ms and filters the roster by name", async () => {
    setMediaDevices("denied");
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText("Bob Müller")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("manual.searchPlaceholder");
    fireEvent.change(input, { target: { value: "anna" } });

    // Synchronously after the keystroke (debounce not yet fired) the full list is intact.
    expect(screen.getByText("Bob Müller")).toBeInTheDocument();
    expect(screen.getByText("Anna Schmidt")).toBeInTheDocument();

    // After the 250ms debounce the client-side filter removes the non-matching row.
    await waitFor(() => {
      expect(screen.queryByText("Bob Müller")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Anna Schmidt")).toBeInTheDocument();
  });

  // ── Manual check-in outcome banners ────────────────────────────────────────
  it("renders the CheckedIn banner after a successful manual check-in", async () => {
    setMediaDevices("denied");
    apiPost.mockResolvedValue(
      apiResult({
        outcome: "CheckedIn",
        registration: registration(),
        wasAlreadyCheckedIn: false,
      })
    );
    await renderPage();

    const button = await screen.findAllByRole("button", {
      name: "manual.checkInButton",
    });
    fireEvent.click(button[0]);

    await waitFor(() => {
      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("result.checkedIn");
    });
    // The optional audit search term is forwarded as `null` in the POST body when no
    // search was typed (service `searchQuery ?? null`, preserved by the slice api fn).
    expect(apiPost).toHaveBeenCalledWith(manualEndpoint("reg-anna"), {
      searchQuery: null,
    });
  });

  it("renders the AlreadyCheckedIn banner with the checkedInAt time", async () => {
    setMediaDevices("denied");
    apiPost.mockResolvedValue(
      apiResult({
        outcome: "AlreadyCheckedIn",
        registration: registration({ checkedInAt: "2026-11-01T18:30:00Z" }),
        wasAlreadyCheckedIn: true,
      })
    );
    await renderPage();

    const button = await screen.findAllByRole("button", {
      name: "manual.checkInButton",
    });
    fireEvent.click(button[0]);

    await waitFor(() => {
      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("result.alreadyCheckedIn");
      // The interpolated vars carry the participant name (time is locale-formatted).
      expect(status).toHaveTextContent("Anna Schmidt");
    });
  });

  it("renders the cancelledConflict banner for a Conflict/Cancelled outcome", async () => {
    setMediaDevices("denied");
    apiPost.mockResolvedValue(
      apiResult({
        outcome: "Conflict",
        conflict: "Cancelled",
        registration: registration(),
        wasAlreadyCheckedIn: false,
      })
    );
    await renderPage();

    const button = await screen.findAllByRole("button", {
      name: "manual.checkInButton",
    });
    fireEvent.click(button[0]);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "result.cancelledConflict"
      );
    });
  });

  it("renders the waitlistedConflict banner for a Conflict/Waitlisted outcome", async () => {
    setMediaDevices("denied");
    apiPost.mockResolvedValue(
      apiResult({
        outcome: "Conflict",
        conflict: "Waitlisted",
        registration: registration(),
        wasAlreadyCheckedIn: false,
      })
    );
    await renderPage();

    const button = await screen.findAllByRole("button", {
      name: "manual.checkInButton",
    });
    fireEvent.click(button[0]);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "result.waitlistedConflict"
      );
    });
  });

  it("renders the checkInFailed network banner when manual check-in returns no data", async () => {
    setMediaDevices("denied");
    apiPost.mockResolvedValue(apiResult(null, { error: "boom", status: 500 }));
    await renderPage();

    const button = await screen.findAllByRole("button", {
      name: "manual.checkInButton",
    });
    fireEvent.click(button[0]);

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("manual.checkInFailed");
    });
  });

  it("renders checkInFailed when manual check-in throws", async () => {
    setMediaDevices("denied");
    apiPost.mockRejectedValue(new Error("network down"));
    await renderPage();

    const button = await screen.findAllByRole("button", {
      name: "manual.checkInButton",
    });
    fireEvent.click(button[0]);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "manual.checkInFailed"
      );
    });
  });

  // ── refreshKey-keyed roster reload after a successful check-in ──────────────
  it("reloads the roster after a successful manual check-in (refreshKey bump)", async () => {
    setMediaDevices("denied");
    apiPost.mockResolvedValue(
      apiResult({
        outcome: "CheckedIn",
        registration: registration(),
        wasAlreadyCheckedIn: false,
      })
    );
    await renderPage();

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledTimes(1);
    });

    const button = screen.getAllByRole("button", {
      name: "manual.checkInButton",
    });
    fireEvent.click(button[0]);

    await waitFor(() => {
      // The successful check-in bumps refreshKey, re-running the roster-load effect.
      expect(apiGet).toHaveBeenCalledTimes(2);
    });
  });

  it("does NOT reload the roster when the check-in fails", async () => {
    setMediaDevices("denied");
    apiPost.mockResolvedValue(apiResult(null, { error: "boom", status: 500 }));
    await renderPage();

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledTimes(1);
    });

    const button = screen.getAllByRole("button", {
      name: "manual.checkInButton",
    });
    fireEvent.click(button[0]);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "manual.checkInFailed"
      );
    });
    expect(apiGet).toHaveBeenCalledTimes(1);
  });

  // ── loadRosterFailed ───────────────────────────────────────────────────────
  it("renders loadRosterFailed when the roster load rejects (returns no data)", async () => {
    setMediaDevices("denied");
    apiGet.mockResolvedValue(
      apiResult(null, { error: "roster down", status: 500 })
    );
    await renderPage();

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("manual.loadRosterFailed");
    });
  });

  // ── actionInFlight disabled state ──────────────────────────────────────────
  it("disables the check-in button while a manual check-in is in flight", async () => {
    setMediaDevices("denied");
    let resolveCheckIn: (v: unknown) => void = () => {};
    apiPost.mockReturnValue(
      new Promise((resolve) => {
        resolveCheckIn = resolve;
      }) as never
    );
    await renderPage();

    const button = (
      await screen.findAllByRole("button", { name: "manual.checkInButton" })
    )[0];
    fireEvent.click(button);

    // The clicked row's button is disabled while actionInFlight === registrationId.
    await waitFor(() => {
      expect(
        screen.getAllByRole("button", { name: "manual.checkInButton" })[0]
      ).toBeDisabled();
    });

    await act(async () => {
      resolveCheckIn(
        apiResult({
          outcome: "CheckedIn",
          registration: registration(),
          wasAlreadyCheckedIn: false,
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("result.checkedIn");
    });
  });

  // ── QR-path outcome banners ────────────────────────────────────────────────
  it("renders the CheckedIn banner after a successful QR scan", async () => {
    setMediaDevices("available");
    apiPost.mockResolvedValue(
      apiResult({
        outcome: "CheckedIn",
        registration: registration(),
        wasAlreadyCheckedIn: false,
      })
    );
    await renderPage();

    await emitScan("tok-anna");

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("result.checkedIn");
    });
    // The QR token is URL-encoded into the route + an empty body POSTed (byte-identical
    // to the service `checkInByQrCode`).
    expect(apiPost).toHaveBeenCalledWith(qrEndpoint("tok-anna"), {});
  });

  it("maps a NotFound QR outcome to the invalidQr banner (token prefix)", async () => {
    setMediaDevices("available");
    apiPost.mockResolvedValue(
      apiResult({
        outcome: "NotFound",
        registration: null,
        wasAlreadyCheckedIn: false,
      })
    );
    await renderPage();

    await emitScan("tok-anna-1234567890");

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("scanner.invalidQr");
      // The page slices the token to its first 8 chars for the banner.
      expect(alert).toHaveTextContent("tok-anna");
    });
    // NotFound is NOT a result banner.
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("maps a 5xx QR response to the networkError banner", async () => {
    setMediaDevices("available");
    apiPost.mockResolvedValue(apiResult(null, { error: "boom", status: 502 }));
    await renderPage();

    await emitScan("tok-anna");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "scanner.networkError"
      );
    });
  });

  it("maps a status-0 (transport) QR response to the networkError banner", async () => {
    setMediaDevices("available");
    apiPost.mockResolvedValue(apiResult(null, { error: null, status: 0 }));
    await renderPage();

    await emitScan("tok-anna");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "scanner.networkError"
      );
    });
  });

  it("shows networkError when the QR check-in call throws", async () => {
    setMediaDevices("available");
    apiPost.mockRejectedValue(new Error("offline"));
    await renderPage();

    await emitScan("tok-anna");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "scanner.networkError"
      );
    });
  });

  // ── QR token dedupe via lastScannedToken ───────────────────────────────────
  it("dedupes the same QR token so a still viewfinder only checks in once", async () => {
    setMediaDevices("available");
    apiPost.mockResolvedValue(
      apiResult({
        outcome: "CheckedIn",
        registration: registration(),
        wasAlreadyCheckedIn: false,
      })
    );
    await renderPage();

    await emitScan("tok-anna");
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("result.checkedIn");
    });
    // Re-emitting the identical token must be ignored.
    await emitScan("tok-anna");
    await emitScan("tok-anna");

    expect(apiPost).toHaveBeenCalledTimes(1);
  });

  // ── scanAgain reset clears networkError + lastScannedToken ──────────────────
  it("scanAgain clears the networkError banner and re-enables the same token", async () => {
    setMediaDevices("available");
    apiPost.mockResolvedValueOnce(
      apiResult(null, { error: "boom", status: 500 })
    );
    await renderPage();

    await emitScan("tok-anna");
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "scanner.networkError"
      );
    });

    // Click "scan again" — clears networkError + lastScannedToken.
    fireEvent.click(screen.getByRole("button", { name: "scanner.scanAgain" }));
    await waitFor(() => {
      expect(
        screen.queryByText("scanner.networkError")
      ).not.toBeInTheDocument();
    });

    // The same token now succeeds (dedupe was reset), proving lastScannedToken cleared.
    apiPost.mockResolvedValueOnce(
      apiResult({
        outcome: "CheckedIn",
        registration: registration(),
        wasAlreadyCheckedIn: false,
      })
    );
    await emitScan("tok-anna");
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("result.checkedIn");
    });
    expect(apiPost).toHaveBeenCalledTimes(2);
  });

  // ── refreshKey reload after a successful QR check-in ────────────────────────
  it("reloads the roster after a successful QR check-in", async () => {
    setMediaDevices("available");
    apiPost.mockResolvedValue(
      apiResult({
        outcome: "CheckedIn",
        registration: registration(),
        wasAlreadyCheckedIn: false,
      })
    );
    await renderPage();

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledTimes(1);
    });

    await emitScan("tok-anna");

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledTimes(2);
    });
  });

  // ── transient scanner onError banner ───────────────────────────────────────
  it("surfaces a transient scanner error without flipping to manual", async () => {
    setMediaDevices("available");
    await renderPage();

    const errBtn = await screen.findByTestId("qr-error");
    fireEvent.click(errBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "scanner.transientError"
      );
    });
    // Scanner tab stays active (only the camera probe flips us to manual).
    expect(screen.getByTestId("qr-scanner-stub")).toBeInTheDocument();
  });
});
