// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * E29-S1 (AC-2/7/9/10/11): Characterization tests for the self-service Profile
 * page (REQ-016/REQ-029/REQ-030) BEFORE the E29-S4 feature-slice + RHF+Zod +
 * TanStack refactor.
 *
 * Pins the CURRENT observable behaviour of `frontend/src/app/profile/page.tsx`:
 * the guard matrix (login / `/` / no-member-record), the raw-`fetch`
 * `GET`/`PUT /api/v1/members/me` load + view↔edit toggle + submit + cancel, and
 * the THREE consent branches (silent load-failure, success+3 s auto-dismiss,
 * explicit-error-no-timer — A76 load-bearing). The Channel-Preferences card is
 * only asserted PRESENT here; its internals are covered by the existing
 * `ChannelPreferencesCard.test.tsx` (left untouched).
 *
 * E29-S4 transport adaptation (the licensed mechanism surface): DEC-1=A migrated
 * the `/members/me` GET/PUT from raw `fetch`+`useAuth().accessToken` to the
 * `useApiClient()` client. So the `@/lib/auth` mock now ALSO returns a STABLE
 * `useApiClient` spy ({data,error,status}), and the `/members/me` assertions
 * target `apiClient.get/put("/api/v1/members/me")` instead of `fetch`. EVERY
 * behavioural assertion (guard matrix, 404 no-member view + links, view↔edit,
 * PUT success/error, Cancel, the consent THREE branches) is otherwise unchanged
 * — only the member-record TRANSPORT moved. The `vi.mock("@/lib/api/privacy")`
 * consent + channel mocks STILL intercept (DEC-1=A keeps that module), the real
 * `@/lib/api/members` helpers (colour + translation-key) run unmocked, and the
 * page renders inside a fresh `QueryClientProvider` (retry:false).
 */

// next-intl: one captured (stable) identity translator (A64); echo vars so the
// `memberSince` interpolation doesn't throw.
vi.mock("next-intl", () => {
  const translate = (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key;
  return { useTranslations: () => translate };
});

// next/navigation: stable router so push() is assertable.
const push = vi.fn();
const router = { push, replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

// next/link: render a real anchor so href is observable.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// @/lib/auth: configurable, STABLE auth state (mutated in place per test) + a
// STABLE `useApiClient` spy (E29-S4 DEC-1=A — the `/members/me` transport). The
// `get`/`put` spies are defined once (stable identity — A78) and configured per
// test via `apiGet`/`apiPut`.
const authState = {
  isAuthenticated: true,
  isLoading: false,
  isMember: true,
  isAdmin: false,
  isVorstand: false,
  accessToken: "test-token" as string | null,
};
const apiGet = vi.fn();
const apiPut = vi.fn();
const apiClient = {
  get: (...a: unknown[]) => apiGet(...a),
  put: (...a: unknown[]) => apiPut(...a),
  post: vi.fn(),
  delete: vi.fn(),
  upload: vi.fn(),
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => apiClient,
}));

// @/lib/api/privacy: consent + channel-preference fns (the card consumes the
// channel fns; let it render with these mocked).
const getConsents = vi.fn();
const grantConsent = vi.fn();
const revokeConsent = vi.fn();
const getChannelPreference = vi.fn();
const updateChannelPreference = vi.fn();
vi.mock("@/lib/api/privacy", () => ({
  getConsents: (...a: unknown[]) => getConsents(...a),
  grantConsent: (...a: unknown[]) => grantConsent(...a),
  revokeConsent: (...a: unknown[]) => revokeConsent(...a),
  getChannelPreference: (...a: unknown[]) => getChannelPreference(...a),
  updateChannelPreference: (...a: unknown[]) => updateChannelPreference(...a),
}));

import ProfilePage from "./page";

const ME_URL = "/api/v1/members/me";

function makeMember(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    firstName: "Anna",
    lastName: "Alpha",
    email: "anna@alpha.example",
    phone: "+41 11 111 11 11",
    street: "Hauptstrasse 1",
    city: "Zürich",
    postalCode: "8000",
    country: "CH",
    membershipType: "Regular",
    membershipTypeDisplay: "Regular",
    status: "Active",
    statusDisplay: "Active",
    memberSince: "2020-01-15",
    ...overrides,
  };
}

// `useApiClient` result shape ({data,error,status}; never throws). The slice
// `useProfile`/`useUpdateProfile` hooks translate a 404 → the no-member view, a
// non-404 error → `error.loadingError`, and a PUT error → the banner.
type ApiResult = { data: unknown; error: string | null; status: number };
function apiResult(status: number, body: unknown): ApiResult {
  const ok = status >= 200 && status < 300;
  return {
    data: ok ? body : null,
    error: ok ? null : `error-${status}`,
    status,
  };
}

// Per-test handles for the `useApiClient` GET/PUT (replace the old raw-fetch
// handles — DEC-1=A transport).
let getResponse: () => Promise<ApiResult>;
let putResponse: () => Promise<ApiResult>;

beforeEach(() => {
  vi.clearAllMocks();

  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.isMember = true;
  authState.isAdmin = false;
  authState.isVorstand = false;
  authState.accessToken = "test-token";

  getResponse = () => Promise.resolve(apiResult(200, makeMember()));
  putResponse = () => Promise.resolve(apiResult(200, makeMember()));
  apiGet.mockImplementation(() => getResponse());
  apiPut.mockImplementation(() => putResponse());

  // Consent: default to a known two-type list (Newsletter granted).
  getConsents.mockResolvedValue([
    { type: "Newsletter", isGranted: true },
    { type: "EventNotifications", isGranted: false },
  ]);
  grantConsent.mockResolvedValue(undefined);
  revokeConsent.mockResolvedValue(undefined);

  // Channel-preferences card load (kept minimal — its own test covers details).
  getChannelPreference.mockResolvedValue({
    preferredChannel: "Email",
    availableChannels: [{ channel: "Email", isEnabled: true }],
  });
  updateChannelPreference.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      // `retryDelay: 0`: the E29 review (P4) gives `useProfile` a per-query
      // `retry` PREDICATE (404 → no retry; other errors → the provider's
      // `retry: 1`). A function `retry` overrides this client's `retry: false`,
      // so a non-404 GET error now retries once — `retryDelay: 0` lets that
      // single retry settle instantly so the inline-error assertion stays fast.
      queries: { retry: false, retryDelay: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProfilePage />
    </QueryClientProvider>
  );
}

// `useApiClient` calls to /members/me by HTTP method (DEC-1=A transport): GET
// hits `apiGet`, PUT hits `apiPut`. Each returns the call list filtered to the
// `/members/me` endpoint so the existing assertions read unchanged.
function meCalls(method: string) {
  const spy = method.toUpperCase() === "PUT" ? apiPut : apiGet;
  return spy.mock.calls.filter((c) => c[0] === ME_URL);
}

describe("ProfilePage — characterization (current behaviour)", () => {
  // ---- AC-2: guard matrix -------------------------------------------------

  it("redirects unauthenticated users to /login and does not fetch /members/me", async () => {
    authState.isAuthenticated = false;
    authState.isMember = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(meCalls("GET")).toHaveLength(0);
  });

  it("redirects authenticated non-members to / and does not fetch /members/me", async () => {
    authState.isAuthenticated = true;
    authState.isMember = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(meCalls("GET")).toHaveLength(0);
  });

  it("renders the no-member-record MEMBER view (no /admin link) on a 404", async () => {
    getResponse = () => Promise.resolve(apiResult(404, null));

    renderPage();

    expect(
      await screen.findByText("profile.noProfileMessageMember")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("profile.noProfileMessageAdmin")
    ).not.toBeInTheDocument();
    // always a /profile/security link…
    expect(
      screen.getByRole("link", { name: "profile.goToSecurity" })
    ).toHaveAttribute("href", "/profile/security");
    // …but NO /admin link for a plain member
    expect(
      screen.queryByRole("link", { name: "profile.goToAdmin" })
    ).not.toBeInTheDocument();
  });

  it("renders the no-member-record ADMIN view (with /admin link) on a 404", async () => {
    authState.isAdmin = true;
    getResponse = () => Promise.resolve(apiResult(404, null));

    renderPage();

    expect(
      await screen.findByText("profile.noProfileMessageAdmin")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "profile.goToAdmin" })
    ).toHaveAttribute("href", "/admin");
    expect(
      screen.getByRole("link", { name: "profile.goToSecurity" })
    ).toHaveAttribute("href", "/profile/security");
  });

  it("shows the no-record admin view for a Vorstand user too", async () => {
    authState.isAdmin = false;
    authState.isVorstand = true;
    getResponse = () => Promise.resolve(apiResult(404, null));

    renderPage();

    expect(
      await screen.findByText("profile.noProfileMessageAdmin")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "profile.goToAdmin" })
    ).toBeInTheDocument();
  });

  // ---- AC-7: load + view --------------------------------------------------

  it("loads /members/me via the api client and renders the profile view", async () => {
    // E29-S4 transport: the bearer token is now applied inside `useApiClient`
    // (auth.ts), not at the call site — so we assert the GET hit the
    // byte-identical `/members/me` endpoint (the URL contract is preserved)
    // rather than inspecting a per-call Authorization header.
    renderPage();

    await waitFor(() => expect(meCalls("GET").length).toBeGreaterThan(0));
    expect(apiGet).toHaveBeenCalledWith(ME_URL);
    expect(await screen.findByText("Anna Alpha")).toBeInTheDocument();
    // contact details (email link) present in the read view
    expect(
      screen.getByRole("link", { name: "anna@alpha.example" })
    ).toBeInTheDocument();
  });

  it("shows the loading spinner while the GET is pending", async () => {
    getResponse = () => new Promise<ApiResult>(() => {});

    const { container } = renderPage();

    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders the inline error notice when the GET fails (non-404)", async () => {
    getResponse = () => Promise.resolve(apiResult(500, null));

    renderPage();

    expect(await screen.findByText("error.notice")).toBeInTheDocument();
    expect(screen.getByText("error.loadingError")).toBeInTheDocument();
  });

  it("renders the channel-preferences card in the read view", async () => {
    renderPage();
    await screen.findByText("Anna Alpha");

    expect(
      await screen.findByText("channelPreferences.title")
    ).toBeInTheDocument();
  });

  // ---- AC-7: view↔edit toggle + field set --------------------------------

  it("toggles into the edit form and exposes the required/optional field set", async () => {
    renderPage();
    await screen.findByText("Anna Alpha");

    fireEvent.click(screen.getByRole("button", { name: "common.edit" }));

    const firstName = (await screen.findByLabelText(
      "form.firstName *"
    )) as HTMLInputElement;
    const lastName = screen.getByLabelText(
      "form.lastName *"
    ) as HTMLInputElement;
    const street = screen.getByLabelText("form.street *") as HTMLInputElement;
    const postalCode = screen.getByLabelText(
      "form.postalCode *"
    ) as HTMLInputElement;
    const city = screen.getByLabelText("form.city *") as HTMLInputElement;
    const phone = screen.getByLabelText("form.phone") as HTMLInputElement;
    const country = screen.getByLabelText("form.country") as HTMLInputElement;

    // required fields
    expect(firstName.required).toBe(true);
    expect(lastName.required).toBe(true);
    expect(street.required).toBe(true);
    expect(postalCode.required).toBe(true);
    expect(city.required).toBe(true);
    // optional fields
    expect(phone.required).toBe(false);
    expect(country.required).toBe(false);

    // form is pre-filled from the loaded member
    expect(firstName.value).toBe("Anna");
    expect(phone.value).toBe("+41 11 111 11 11");
  });

  it("submits a PUT /members/me, closes the edit form and updates the member on success", async () => {
    putResponse = () =>
      Promise.resolve(apiResult(200, makeMember({ firstName: "Annabelle" })));

    renderPage();
    await screen.findByText("Anna Alpha");
    fireEvent.click(screen.getByRole("button", { name: "common.edit" }));
    await screen.findByLabelText("form.firstName *");

    fireEvent.change(screen.getByLabelText("form.firstName *"), {
      target: { value: "Annabelle" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(meCalls("PUT")).toHaveLength(1));
    // E29-S4 transport: `useApiClient.put(url, body)` receives the body as a
    // plain object (the client JSON-stringifies internally), not a pre-encoded
    // string — so we read the body from the second positional arg. The field
    // set (`UpdateOwnProfileRequest`) is byte-identical.
    const body = meCalls("PUT")[0][1] as Record<string, unknown>;
    expect(body).toMatchObject({
      firstName: "Annabelle",
      lastName: "Alpha",
    });
    // edit form closed (Save button gone) + member updated from the response
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "common.save" })
      ).not.toBeInTheDocument()
    );
    expect(screen.getByText("Annabelle Alpha")).toBeInTheDocument();
  });

  it("on a failed PUT shows the error banner and stays in edit mode", async () => {
    // E29-S4 transport: `useApiClient` surfaces the server message as
    // `result.error`; the update mutation throws it so the form banner renders
    // it verbatim (the god-page `setError(errorData.message)` behaviour). The
    // observable outcome — banner shows the server message, stays in edit — is
    // unchanged.
    putResponse = () =>
      Promise.resolve({ data: null, error: "boom-save", status: 400 });

    renderPage();
    await screen.findByText("Anna Alpha");
    fireEvent.click(screen.getByRole("button", { name: "common.edit" }));
    await screen.findByLabelText("form.firstName *");

    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    expect(await screen.findByText("boom-save")).toBeInTheDocument();
    // still in edit mode — Save button persists
    expect(
      screen.getByRole("button", { name: "common.save" })
    ).toBeInTheDocument();
  });

  it("Cancel resets edited form data back to the loaded member and exits edit", async () => {
    renderPage();
    await screen.findByText("Anna Alpha");
    fireEvent.click(screen.getByRole("button", { name: "common.edit" }));
    await screen.findByLabelText("form.firstName *");

    fireEvent.change(screen.getByLabelText("form.firstName *"), {
      target: { value: "Changed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));

    // exits edit
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "common.save" })
      ).not.toBeInTheDocument()
    );
    // re-open: the edited value was reset to the original
    fireEvent.click(screen.getByRole("button", { name: "common.edit" }));
    const firstName = (await screen.findByLabelText(
      "form.firstName *"
    )) as HTMLInputElement;
    expect(firstName.value).toBe("Anna");
    expect(meCalls("PUT")).toHaveLength(0);
  });

  // ---- AC-7 / AC-9: CONSENT — the THREE branches (A76, load-bearing) ------

  it("BRANCH 1: silently swallows a getConsents load failure (no error surface)", async () => {
    getConsents.mockRejectedValue(new Error("consents down"));

    renderPage();
    await screen.findByText("Anna Alpha");

    // the consent section still renders (its heading is present)…
    expect(screen.getByText("profile.consentPreferences")).toBeInTheDocument();
    // …and NO consent message banner appears (empty catch)
    expect(screen.queryByText("profile.consentError")).not.toBeInTheDocument();
    expect(screen.queryByText("profile.consentSaved")).not.toBeInTheDocument();
  });

  it("BRANCH 2: a successful consent toggle shows a success message that auto-dismisses after 3000 ms", async () => {
    vi.useFakeTimers();
    // first call resolves the initial load; subsequent the refetch.
    getConsents.mockResolvedValue([
      { type: "Newsletter", isGranted: true },
      { type: "EventNotifications", isGranted: false },
    ]);

    renderPage();

    // drive the async load under fake timers
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("Anna Alpha")).toBeInTheDocument();

    // EventNotifications is currently NOT granted → toggle should GRANT it
    const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    fireEvent.click(checkboxes[1]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(grantConsent).toHaveBeenCalledWith(
      "test-token",
      "EventNotifications"
    );
    expect(screen.getByText("profile.consentSaved")).toBeInTheDocument();

    // advance past the 3 s auto-dismiss timer → message gone
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(screen.queryByText("profile.consentSaved")).not.toBeInTheDocument();
  });

  it("BRANCH 2b: toggling an already-granted consent calls revokeConsent", async () => {
    // E29-S4 mechanism: consent load is now a TanStack query (was a manual
    // fetch settling in the same effect tick), so wait for the granted state to
    // settle before toggling. The behavioural assertion (granted → REVOKE) is
    // unchanged.
    renderPage();

    const checkboxes = (await screen.findAllByRole(
      "checkbox"
    )) as HTMLInputElement[];
    // Newsletter starts granted → wait for the query to reflect it
    await waitFor(() => expect(checkboxes[0].checked).toBe(true));

    fireEvent.click(checkboxes[0]);

    await waitFor(() =>
      expect(revokeConsent).toHaveBeenCalledWith("test-token", "Newsletter")
    );
  });

  it("BRANCH 3: an explicit consent toggle error shows a message with NO auto-dismiss timer", async () => {
    vi.useFakeTimers();
    grantConsent.mockRejectedValue(new Error("grant failed"));

    renderPage();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    fireEvent.click(checkboxes[1]); // grant → rejects

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("profile.consentError")).toBeInTheDocument();

    // advancing well past 3 s does NOT clear the error (no timer on the error branch)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(screen.getByText("profile.consentError")).toBeInTheDocument();
  });

  it("renders both consent checkboxes (Newsletter + EventNotifications) reflecting granted state", async () => {
    renderPage();
    await screen.findByText("Anna Alpha");

    const consentSection = screen
      .getByText("profile.consentPreferences")
      .closest("div")!;
    const checkboxes = within(consentSection).getAllByRole(
      "checkbox"
    ) as HTMLInputElement[];
    expect(checkboxes).toHaveLength(2);
    // Newsletter granted, EventNotifications not (from the default mock).
    // E29-S4 mechanism: consent load is now an async TanStack query, so wait
    // for the granted state to settle (the checked-state assertion is unchanged).
    await waitFor(() => expect(checkboxes[0].checked).toBe(true));
    expect(checkboxes[1].checked).toBe(false);
  });
});
