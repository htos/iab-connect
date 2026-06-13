// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * E25-S1 detail net (the RICHEST E25 surface + the action MATRIX oracle), ADAPTED
 * for the E25-S3 feature-slice extraction. The page now routes through the slice's
 * `useApiClient`-based api layer instead of inline `fetch`, so the transport seam
 * moves from a global `fetch` spy to a STABLE `useApiClient` spy (the documented A88
 * adaptation): `vi.mock("@/lib/auth")` also returns a `useApiClient()` whose
 * `get`/`post` resolve `{ data, error, status }` per test, and the transport
 * assertions are re-pointed from "global fetch with URL/method" to "`api.get`/
 * `api.post` with endpoint + body". EVERY behavioural assertion is preserved
 * verbatim: the auth gate, the 3 parallel loads, the DOMPurify preview, the
 * recipients table, the FULL per-status action MATRIX (Draft Edit/Test/Schedule/
 * Send-now(confirm); Scheduled Cancel(confirm); Sent Resend all-vs-failed +
 * failed-disabled-when-failed===0; Sending stats only), each action ENDPOINT +
 * confirm gate + success(refetch)/error(alert), and the not-found view.
 *
 * The success-refetch is now invalidation-driven (the action `onSuccess`
 * invalidates detail/statistics/recipients → TanStack refetches → the campaign GET
 * count grows), preserving the god-page's `await fetchCampaign()` re-load. The
 * error branch keeps the god-page's FIXED failure-key `alert(...)`, NOT the server
 * message (A76).
 */

vi.mock("next-intl", () => {
  const translate = (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key;
  return { useTranslations: () => translate };
});

const push = vi.fn();
const router = { push, replace: vi.fn(), refresh: vi.fn() };
const params = { id: "c1" };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useParams: () => params,
}));

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

const authState = {
  isAuthenticated: true,
  isLoading: false,
  isVorstand: true,
  isAdmin: false,
  accessToken: "tok" as string | null,
};

// A88 transport seam: a STABLE api-client spy (the slice routes through
// `useApiClient`). `get`/`post` resolve `{ data, error, status }` per test.
const apiClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  upload: vi.fn(),
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => apiClient,
}));

import EmailCampaignDetailPage from "./page";

function makeCampaign(overrides: Record<string, unknown> = {}) {
  return {
    id: "c1",
    name: "Spring Newsletter",
    subject: "Welcome Spring",
    htmlContent: "<p>hello <strong>world</strong></p>",
    fromName: "Club",
    fromEmail: "club@example.org",
    segmentType: "AllActiveMembers",
    status: "Draft",
    scheduledAt: undefined as string | undefined,
    sentAt: undefined as string | undefined,
    totalRecipients: 5,
    sentCount: 0,
    deliveredCount: 0,
    openedCount: 0,
    clickedCount: 0,
    bouncedCount: 0,
    failedCount: 0,
    createdById: "u1",
    createdByName: "Alice",
    createdAt: "2026-01-15T00:00:00Z",
    ...overrides,
  };
}

function makeStats(overrides: Record<string, unknown> = {}) {
  return {
    totalRecipients: 5,
    sent: 5,
    delivered: 4,
    opened: 3,
    clicked: 2,
    bounced: 1,
    failed: 0,
    openRate: 0.6,
    clickRate: 0.4,
    bounceRate: 0.2,
    ...overrides,
  };
}

function makeRecipient(overrides: Record<string, unknown> = {}) {
  return {
    id: "r1",
    campaignId: "c1",
    email: "bob@example.org",
    firstName: "Bob",
    lastName: "Builder",
    status: "Delivered",
    ...overrides,
  };
}

// Per-test transport state.
let campaignOk: boolean;
let campaignPayload: ReturnType<typeof makeCampaign>;
let statsPayload: ReturnType<typeof makeStats>;
let recipientsPayload: { items: ReturnType<typeof makeRecipient>[] };
let actionOk: boolean;

const BASE = "/api/v1/email-campaigns";

function findActionCall(suffix: string) {
  return apiClient.post.mock.calls.find(
    (c) => typeof c[0] === "string" && c[0] === `${BASE}/c1/${suffix}`
  );
}

function campaignLoadCount() {
  return apiClient.get.mock.calls.filter((c) => c[0] === `${BASE}/c1`).length;
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.isVorstand = true;
  authState.isAdmin = false;
  authState.accessToken = "tok";

  campaignOk = true;
  campaignPayload = makeCampaign();
  statsPayload = makeStats();
  recipientsPayload = { items: [makeRecipient()] };
  actionOk = true;

  apiClient.get.mockImplementation((url: string) => {
    if (url.endsWith("/statistics")) {
      return Promise.resolve({ data: statsPayload, error: null, status: 200 });
    }
    if (url.includes("/recipients")) {
      return Promise.resolve({
        data: recipientsPayload,
        error: null,
        status: 200,
      });
    }
    // base campaign GET
    return Promise.resolve(
      campaignOk
        ? { data: campaignPayload, error: null, status: 200 }
        : { data: null, error: "notFound", status: 404 }
    );
  });
  apiClient.post.mockImplementation(() =>
    Promise.resolve(
      actionOk
        ? { data: null, error: null, status: 200 }
        : { data: null, error: "failed", status: 400 }
    )
  );

  vi.stubGlobal(
    "confirm",
    vi.fn(() => true)
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <EmailCampaignDetailPage />
    </QueryClientProvider>
  );
}

describe("EmailCampaignDetailPage — characterization (current behaviour)", () => {
  // --- auth guard (Vorstand OR Admin only) ---

  it("redirects an unauthenticated user to /login and fires no load", async () => {
    authState.isAuthenticated = false;
    authState.isVorstand = false;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(campaignLoadCount()).toBe(0);
  });

  it("redirects an authenticated Member-only user to / and fires no load", async () => {
    authState.isVorstand = false;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(campaignLoadCount()).toBe(0);
  });

  it("loads the campaign for an Admin-only user", async () => {
    authState.isVorstand = false;
    authState.isAdmin = true;

    renderPage();

    expect(await screen.findByText("Spring Newsletter")).toBeInTheDocument();
  });

  // --- parallel load: campaign + statistics + recipients ---

  it("fires the 3 parallel load fetches (campaign + statistics + recipients)", async () => {
    renderPage();
    await screen.findByText("Spring Newsletter");

    const urls = apiClient.get.mock.calls.map((c) => c[0] as string);
    expect(urls.some((u) => u === `${BASE}/c1`)).toBe(true);
    expect(urls.some((u) => u.endsWith("/c1/statistics"))).toBe(true);
    expect(
      urls.some((u) => u.endsWith("/c1/recipients?page=1&pageSize=100"))
    ).toBe(true);
  });

  it("renders header (name + subject) and the status badge with the status key", async () => {
    renderPage();
    await screen.findByText("Spring Newsletter");

    // subject renders twice: the header <p> + the email-preview subject <h3>.
    expect(screen.getAllByText("Welcome Spring").length).toBeGreaterThan(0);
    // detail badge uses t(`status${status}`) → "statusDraft". `statusDraft` also
    // appears in the preview-card date fallback <div>, so pin the BADGE by its
    // shared-Badge `rounded-full` pill class.
    const badge = screen
      .getAllByText("statusDraft")
      .find((el) => el.classList.contains("rounded-full"));
    expect(badge).toBeTruthy();
    expect(badge).toHaveClass("rounded-full");
  });

  // --- DOMPurify preview present ---

  it("renders the DOMPurify-sanitized HTML preview", async () => {
    renderPage();
    await screen.findByText("Spring Newsletter");

    // emailPreview label is present and the sanitized body content renders.
    expect(screen.getByText("emailPreview")).toBeInTheDocument();
    expect(screen.getByText("world")).toBeInTheDocument();
  });

  // --- recipients render ---

  it("renders the recipients table with the recipient row + status pill", async () => {
    renderPage();
    await screen.findByText("Spring Newsletter");

    expect(screen.getByText("bob@example.org")).toBeInTheDocument();
    // recipient.status is rendered RAW (not i18n) inside the colored pill.
    const pill = screen.getByText("Delivered", { selector: "div" });
    expect(pill).toHaveClass("rounded-full");
  });

  // ======================================================================
  // STATUS → ACTION MATRIX
  // ======================================================================

  // --- Draft: Edit / Send-test-modal / Schedule-modal / Send-now(confirm) ---

  it("Draft shows Edit link + Send-test + Schedule + Send-now actions", async () => {
    renderPage();
    await screen.findByText("Spring Newsletter");

    // Edit appears as both the action-panel link and the preview-card link.
    expect(screen.getAllByText("edit").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: "sendTestEmail" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "schedule" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "sendNow" })).toBeInTheDocument();
    // not the Scheduled/Sent affordances
    expect(
      screen.queryByRole("button", { name: "cancel" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "resend" })
    ).not.toBeInTheDocument();
  });

  it("Send-test modal POSTs to /test with the testEmail body and alerts on success", async () => {
    const alertMock = vi.fn();
    vi.stubGlobal("alert", alertMock);

    renderPage();
    await screen.findByText("Spring Newsletter");

    fireEvent.click(screen.getByRole("button", { name: "sendTestEmail" }));
    fireEvent.change(screen.getByPlaceholderText("test@example.com"), {
      target: { value: "tester@example.org" },
    });
    fireEvent.click(screen.getByRole("button", { name: "modal.sendTest" }));

    await waitFor(() => expect(findActionCall("test")).toBeTruthy());
    const call = findActionCall("test")!;
    expect(call[1]).toEqual({ testEmail: "tester@example.org" });
    await waitFor(() =>
      expect(alertMock).toHaveBeenCalledWith("testEmailSent")
    );
  });

  it("Send-test alerts the failure key when /test is not ok", async () => {
    actionOk = false;
    const alertMock = vi.fn();
    vi.stubGlobal("alert", alertMock);

    renderPage();
    await screen.findByText("Spring Newsletter");

    fireEvent.click(screen.getByRole("button", { name: "sendTestEmail" }));
    fireEvent.change(screen.getByPlaceholderText("test@example.com"), {
      target: { value: "tester@example.org" },
    });
    fireEvent.click(screen.getByRole("button", { name: "modal.sendTest" }));

    await waitFor(() =>
      expect(alertMock).toHaveBeenCalledWith("testEmailFailed")
    );
  });

  it("Schedule modal POSTs to /schedule with an ISO scheduledAt then refetches", async () => {
    renderPage();
    await screen.findByText("Spring Newsletter");
    const before = campaignLoadCount();

    fireEvent.click(screen.getByRole("button", { name: "schedule" }));
    // datetime-local input
    const input = document.querySelector(
      'input[type="datetime-local"]'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2026-06-01T10:00" } });
    // the modal's confirm button reuses the "schedule" key — click the last one.
    const scheduleButtons = screen.getAllByRole("button", {
      name: "schedule",
    });
    fireEvent.click(scheduleButtons[scheduleButtons.length - 1]);

    await waitFor(() => expect(findActionCall("schedule")).toBeTruthy());
    const call = findActionCall("schedule")!;
    const body = call[1] as { scheduledAt: string };
    expect(typeof body.scheduledAt).toBe("string");
    expect(body.scheduledAt).toContain("T");
    await waitFor(() => expect(campaignLoadCount()).toBeGreaterThan(before));
  });

  it("Send-now is gated by confirm(), POSTs to /send and refetches", async () => {
    renderPage();
    await screen.findByText("Spring Newsletter");
    const before = campaignLoadCount();

    fireEvent.click(screen.getByRole("button", { name: "sendNow" }));

    const confirmMock = confirm as unknown as ReturnType<typeof vi.fn>;
    expect(confirmMock).toHaveBeenCalledWith("confirmSendNow");

    await waitFor(() => expect(findActionCall("send")).toBeTruthy());
    await waitFor(() => expect(campaignLoadCount()).toBeGreaterThan(before));
  });

  it("Send-now does NOT POST when confirm is cancelled", async () => {
    vi.stubGlobal(
      "confirm",
      vi.fn(() => false)
    );

    renderPage();
    await screen.findByText("Spring Newsletter");

    fireEvent.click(screen.getByRole("button", { name: "sendNow" }));

    expect(findActionCall("send")).toBeFalsy();
  });

  it("Send-now alerts the failure key when /send is not ok", async () => {
    actionOk = false;
    const alertMock = vi.fn();
    vi.stubGlobal("alert", alertMock);

    renderPage();
    await screen.findByText("Spring Newsletter");

    fireEvent.click(screen.getByRole("button", { name: "sendNow" }));

    await waitFor(() => expect(alertMock).toHaveBeenCalledWith("sendFailed"));
  });

  // --- Scheduled: Cancel(confirm) ---

  it("Scheduled shows the Cancel action and no Draft/Sent panels", async () => {
    campaignPayload = makeCampaign({
      status: "Scheduled",
      scheduledAt: "2026-06-01T10:00:00Z",
    });

    renderPage();
    await screen.findByText("Spring Newsletter");

    expect(screen.getByRole("button", { name: "cancel" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "sendNow" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "resend" })
    ).not.toBeInTheDocument();
  });

  it("Cancel is gated by confirm(), POSTs to /cancel and refetches", async () => {
    campaignPayload = makeCampaign({
      status: "Scheduled",
      scheduledAt: "2026-06-01T10:00:00Z",
    });

    renderPage();
    await screen.findByText("Spring Newsletter");
    const before = campaignLoadCount();

    fireEvent.click(screen.getByRole("button", { name: "cancel" }));

    const confirmMock = confirm as unknown as ReturnType<typeof vi.fn>;
    expect(confirmMock).toHaveBeenCalledWith("confirmCancel");

    await waitFor(() => expect(findActionCall("cancel")).toBeTruthy());
    await waitFor(() => expect(campaignLoadCount()).toBeGreaterThan(before));
  });

  it("Cancel does NOT POST when confirm is cancelled", async () => {
    campaignPayload = makeCampaign({
      status: "Scheduled",
      scheduledAt: "2026-06-01T10:00:00Z",
    });
    vi.stubGlobal(
      "confirm",
      vi.fn(() => false)
    );

    renderPage();
    await screen.findByText("Spring Newsletter");

    fireEvent.click(screen.getByRole("button", { name: "cancel" }));

    expect(findActionCall("cancel")).toBeFalsy();
  });

  it("Cancel alerts the failure key when /cancel is not ok", async () => {
    campaignPayload = makeCampaign({
      status: "Scheduled",
      scheduledAt: "2026-06-01T10:00:00Z",
    });
    actionOk = false;
    const alertMock = vi.fn();
    vi.stubGlobal("alert", alertMock);

    renderPage();
    await screen.findByText("Spring Newsletter");

    fireEvent.click(screen.getByRole("button", { name: "cancel" }));

    await waitFor(() => expect(alertMock).toHaveBeenCalledWith("cancelFailed"));
  });

  // --- Sent: Resend modal (all vs failed) + statistics grid ---

  it("Sent shows the Resend action + the statistics grid", async () => {
    campaignPayload = makeCampaign({
      status: "Sent",
      sentAt: "2026-02-01T00:00:00Z",
    });
    statsPayload = makeStats({ failed: 2 });

    renderPage();
    await screen.findByText("Spring Newsletter");

    expect(screen.getByRole("button", { name: "resend" })).toBeInTheDocument();
    expect(screen.getByText("statistics")).toBeInTheDocument();
    expect(screen.getByText("stats.total")).toBeInTheDocument();
  });

  it("Resend modal: sendToAll POSTs to /resend then refetches", async () => {
    campaignPayload = makeCampaign({
      status: "Sent",
      sentAt: "2026-02-01T00:00:00Z",
    });
    statsPayload = makeStats({ failed: 2 });

    renderPage();
    await screen.findByText("Spring Newsletter");
    const before = campaignLoadCount();

    fireEvent.click(screen.getByRole("button", { name: "resend" }));
    fireEvent.click(screen.getByRole("button", { name: /modal\.sendToAll/ }));

    await waitFor(() => expect(findActionCall("resend")).toBeTruthy());
    expect(findActionCall("resend-failed")).toBeFalsy();
    await waitFor(() => expect(campaignLoadCount()).toBeGreaterThan(before));
  });

  it("Resend modal: sendToFailedOnly POSTs to /resend-failed when failures exist", async () => {
    campaignPayload = makeCampaign({
      status: "Sent",
      sentAt: "2026-02-01T00:00:00Z",
    });
    statsPayload = makeStats({ failed: 2 });

    renderPage();
    await screen.findByText("Spring Newsletter");

    fireEvent.click(screen.getByRole("button", { name: "resend" }));
    fireEvent.click(
      screen.getByRole("button", { name: /modal\.sendToFailedOnly/ })
    );

    await waitFor(() => expect(findActionCall("resend-failed")).toBeTruthy());
  });

  it("Resend modal: sendToFailedOnly is DISABLED when statistics.failed === 0", async () => {
    campaignPayload = makeCampaign({
      status: "Sent",
      sentAt: "2026-02-01T00:00:00Z",
    });
    statsPayload = makeStats({ failed: 0 });

    renderPage();
    await screen.findByText("Spring Newsletter");

    fireEvent.click(screen.getByRole("button", { name: "resend" }));

    expect(
      screen.getByRole("button", { name: /modal\.sendToFailedOnly/ })
    ).toBeDisabled();
  });

  it("Resend alerts the failure key when /resend is not ok", async () => {
    campaignPayload = makeCampaign({
      status: "Sent",
      sentAt: "2026-02-01T00:00:00Z",
    });
    statsPayload = makeStats({ failed: 2 });
    actionOk = false;
    const alertMock = vi.fn();
    vi.stubGlobal("alert", alertMock);

    renderPage();
    await screen.findByText("Spring Newsletter");

    fireEvent.click(screen.getByRole("button", { name: "resend" }));
    fireEvent.click(screen.getByRole("button", { name: /modal\.sendToAll/ }));

    await waitFor(() => expect(alertMock).toHaveBeenCalledWith("resendFailed"));
  });

  // --- Sending: statistics grid, no action panels ---

  it("Sending shows the statistics grid and no Draft/Scheduled/Sent action panels", async () => {
    campaignPayload = makeCampaign({ status: "Sending" });
    statsPayload = makeStats({ failed: 1 });

    renderPage();
    await screen.findByText("Spring Newsletter");

    expect(screen.getByText("statistics")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "sendNow" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "resend" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "cancel" })
    ).not.toBeInTheDocument();
  });

  // --- not-found view (campaign null) ---

  it("renders the not-found view when the campaign GET is not ok", async () => {
    campaignOk = false;

    renderPage();

    // 404 → the not-found sentinel; the error banner shows its message;
    // backToCampaigns link present.
    expect(await screen.findByText("backToCampaigns")).toBeInTheDocument();
    expect(screen.getByText("notFound")).toBeInTheDocument();
  });

  // --- loading lifecycle ---

  it("renders the loading spinner while the load is pending", async () => {
    apiClient.get.mockImplementation(() => new Promise(() => {}));

    const { container } = renderPage();

    await waitFor(() =>
      expect(container.querySelector(".animate-spin")).toBeInTheDocument()
    );
  });
});
