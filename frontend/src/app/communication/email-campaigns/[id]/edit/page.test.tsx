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
 * E25-S1 edit net, ADAPTED for the E25-S3 feature-slice extraction. The page now
 * routes through the slice's `useApiClient`-based api layer instead of inline
 * `fetch`, so the transport seam moves from a global `fetch` spy to a STABLE
 * `useApiClient` spy (A88): `vi.mock("@/lib/auth")` also returns a `useApiClient()`
 * whose `get`/`put` resolve `{ data, error, status }` per test; the load assertion
 * is re-pointed to `api.get` /c1 and the save to `api.put` /c1 + body. EVERY
 * behavioural assertion is preserved: the auth gate, the load+prefill, the
 * non-Draft → editNotPossible notice, the hardcoded German segment labels, the
 * editor toggle, the submit→PUT→navigate, the save error banner, the load-error
 * banner (form still renders, NOT editNotPossible), and the REQ-086 fromName ref
 * fallback (campaign value when present; applicationName only when empty).
 *
 * Mocks: useAppSettings, the TipTap editors, emailTemplatesApi, useAuth +
 * useApiClient, next/navigation (incl. useParams), next-intl, next/link.
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
// `useApiClient`). `get`/`put` resolve `{ data, error, status }` per test.
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

const appSettingsState = {
  settings: { applicationName: "IAB Connect" },
  isLoading: false,
};
vi.mock("@/components/providers/AppSettingsProvider", () => ({
  useAppSettings: () => appSettingsState,
}));

vi.mock("@/components/ui/rich-text-editor", () => ({
  RichTextEditor: ({
    content,
    onChange,
    placeholder,
  }: {
    content: string;
    onChange: (c: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      data-testid="rich-text-editor"
      aria-label="rich-text-editor"
      placeholder={placeholder}
      value={content}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  HtmlSourceEditor: ({
    content,
    onChange,
    placeholder,
  }: {
    content: string;
    onChange: (c: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      data-testid="html-source-editor"
      aria-label="html-source-editor"
      placeholder={placeholder}
      value={content}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

const getAllTemplates = vi.fn();
const getTemplateById = vi.fn();
vi.mock("@/lib/email-templates", () => ({
  emailTemplatesApi: {
    getAllTemplates: (...args: unknown[]) => getAllTemplates(...args),
    getTemplateById: (...args: unknown[]) => getTemplateById(...args),
  },
}));

import EditEmailCampaignPage from "./page";

function makeCampaign(overrides: Record<string, unknown> = {}) {
  return {
    id: "c1",
    name: "Spring Newsletter",
    subject: "Welcome Spring",
    htmlContent: "<p>hi</p>",
    plainTextContent: "hi",
    fromName: "Club",
    fromEmail: "club@example.org",
    replyToEmail: "",
    segmentType: "AllActiveMembers",
    segmentFilter: "",
    status: "Draft",
    totalRecipients: 0,
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

// Per-test transport state.
let campaignOk: boolean;
let campaignPayload: ReturnType<typeof makeCampaign>;
let segmentsPayload: { id: string; name: string; segmentType: string }[];
let saveOk: boolean;
let saveError: string | null;

function findSaveCall() {
  return apiClient.put.mock.calls.find(
    (c) => c[0] === "/api/v1/email-campaigns/c1"
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.isVorstand = true;
  authState.isAdmin = false;
  authState.accessToken = "tok";
  appSettingsState.settings = { applicationName: "IAB Connect" };
  appSettingsState.isLoading = false;

  campaignOk = true;
  campaignPayload = makeCampaign();
  segmentsPayload = [];
  saveOk = true;
  saveError = null;

  getAllTemplates.mockResolvedValue([]);
  getTemplateById.mockResolvedValue({
    subject: "Tmpl subject",
    htmlContent: "<p>tmpl</p>",
    textContent: "tmpl",
  });

  apiClient.get.mockImplementation((url: string) => {
    if (url.includes("/member-segments/active")) {
      return Promise.resolve({ data: segmentsPayload, error: null, status: 200 });
    }
    // base campaign GET
    return Promise.resolve(
      campaignOk
        ? { data: campaignPayload, error: null, status: 200 }
        : { data: null, error: "form.loadError", status: 500 }
    );
  });
  apiClient.put.mockImplementation(() =>
    Promise.resolve(
      saveOk
        ? { data: {}, error: null, status: 200 }
        : { data: null, error: saveError, status: 400 }
    )
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      // `retryDelay: 0` keeps the slice's A93 detail-query retry (one retry on a
      // non-404 generic error — the directed `retry: (n,err)=>!Sentinel && n<1`)
      // deterministic in the test; it changes timing only, no behavioural assertion.
      queries: { retry: false, retryDelay: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <EditEmailCampaignPage />
    </QueryClientProvider>
  );
}

describe("EditEmailCampaignPage (edit form) — characterization (current behaviour)", () => {
  // --- auth guard ---

  it("redirects an unauthenticated user to /login", async () => {
    authState.isAuthenticated = false;
    authState.isVorstand = false;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });

  it("redirects an authenticated Member-only user to /", async () => {
    authState.isVorstand = false;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  // --- load + prefill ---

  it("loads the campaign by id and prefills the form fields", async () => {
    renderPage();

    expect(await screen.findByText("form.editTitle")).toBeInTheDocument();
    expect(
      (
        screen.getByPlaceholderText(
          "form.campaignNamePlaceholder"
        ) as HTMLInputElement
      ).value
    ).toBe("Spring Newsletter");
    expect(
      (
        screen.getByPlaceholderText(
          "form.subjectPlaceholder"
        ) as HTMLInputElement
      ).value
    ).toBe("Welcome Spring");
  });

  it("loads the campaign through the api client (auth encapsulated)", async () => {
    renderPage();
    await screen.findByText("form.editTitle");

    // A88: the Bearer token is now owned by `useApiClient`; the meaningful
    // transport assertion is that the load GET fired against the campaign endpoint.
    const loadCall = apiClient.get.mock.calls.find(
      (c) => c[0] === "/api/v1/email-campaigns/c1"
    );
    expect(loadCall).toBeTruthy();
  });

  // --- non-Draft → editNotPossible notice ---

  it("renders the editNotPossible notice (not the form) for a non-Draft campaign", async () => {
    campaignPayload = makeCampaign({ status: "Sent" });

    renderPage();

    expect(await screen.findByText("form.editNotPossible")).toBeInTheDocument();
    expect(screen.queryByText("form.editTitle")).not.toBeInTheDocument();
  });

  // --- segment-type hardcoded German labels ---

  it("renders the recipient-group select with the hardcoded German segment labels", async () => {
    renderPage();
    await screen.findByText("form.editTitle");

    expect(screen.getByText("Alle aktiven Mitglieder")).toBeInTheDocument();
    expect(screen.getByText("Mitglieder-Segment")).toBeInTheDocument();
  });

  // --- editor toggle ---

  it("toggles between the visual and html editors", async () => {
    renderPage();
    await screen.findByText("form.editTitle");

    expect(screen.getByTestId("rich-text-editor")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /form\.htmlMode/ }));

    expect(screen.getByTestId("html-source-editor")).toBeInTheDocument();
    expect(screen.queryByTestId("rich-text-editor")).not.toBeInTheDocument();
  });

  // --- submit PUTs then navigates ---

  it("submits the form, PUTs to /email-campaigns/{id}, then navigates back to the detail page", async () => {
    renderPage();
    await screen.findByText("form.editTitle");

    fireEvent.change(
      screen.getByPlaceholderText("form.campaignNamePlaceholder"),
      { target: { value: "Renamed" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "form.saveChanges" }));

    await waitFor(() => expect(findSaveCall()).toBeTruthy());
    const call = findSaveCall()!;
    // A88: api.put is called with (endpoint, body) — body is the object directly.
    const body = call[1] as Record<string, unknown>;
    expect(body.name).toBe("Renamed");

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/communication/email-campaigns/c1")
    );
  });

  it("surfaces the save error banner (server message) when the PUT is not ok", async () => {
    saveOk = false;
    saveError = "Validation failed";

    renderPage();
    await screen.findByText("form.editTitle");

    fireEvent.click(screen.getByRole("button", { name: "form.saveChanges" }));

    expect(await screen.findByText("Validation failed")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalledWith("/communication/email-campaigns/c1");
  });

  // --- REQ-086: fromName falls back to applicationName only when campaign value empty ---

  it("REQ-086: prefills fromName from the campaign value when present (ref does not clobber)", async () => {
    appSettingsState.settings = { applicationName: "Org Default" };
    campaignPayload = makeCampaign({ fromName: "Existing Sender" });

    renderPage();
    await screen.findByText("form.editTitle");

    const fromName = screen
      .getAllByRole("textbox")
      .find(
        (el) => (el as HTMLInputElement).name === "fromName"
      ) as HTMLInputElement;
    expect(fromName.value).toBe("Existing Sender");
  });

  it("REQ-086: falls back to settings.applicationName when the campaign fromName is empty", async () => {
    appSettingsState.settings = { applicationName: "Org Default" };
    campaignPayload = makeCampaign({ fromName: "" });

    renderPage();
    await screen.findByText("form.editTitle");

    const fromName = screen
      .getAllByRole("textbox")
      .find(
        (el) => (el as HTMLInputElement).name === "fromName"
      ) as HTMLInputElement;
    expect(fromName.value).toBe("Org Default");
  });

  // --- load lifecycle ---

  it("renders the loading spinner while the campaign load is pending", async () => {
    apiClient.get.mockImplementation(() => new Promise(() => {}));

    const { container } = renderPage();

    await waitFor(() =>
      expect(container.querySelector(".animate-spin")).toBeInTheDocument()
    );
  });

  it("shows the load error banner when the campaign GET is not ok", async () => {
    campaignOk = false;

    renderPage();

    // throws t("form.loadError"); the form still renders (campaign stays null →
    // not the editNotPossible branch) with the error banner.
    expect(await screen.findByText("form.loadError")).toBeInTheDocument();
  });
});
