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
 * E25-S1 create net, ADAPTED for the E25-S3 feature-slice extraction. The page now
 * routes through the slice's `useApiClient`-based api layer instead of inline
 * `fetch`, so the transport seam moves from a global `fetch` spy to a STABLE
 * `useApiClient` spy (A88): `vi.mock("@/lib/auth")` also returns a `useApiClient()`
 * whose `get`/`post` resolve `{ data, error, status }` per test; the create
 * assertion is re-pointed from "global fetch POST /api/v1/email-campaigns" to
 * "`api.post` endpoint /api/v1/email-campaigns + body", and the segment load from
 * the inline fetch to `api.get` /api/v1/member-segments/active. EVERY behavioural
 * assertion is preserved: the auth gate, the hardcoded German segment labels, the
 * template dropdown (active-only) + load-on-select, the segment dropdown, the
 * editor toggle, the submit→POST→navigate, the create error banner, and the
 * REQ-086 fromName race-guard (defaulted value + disabled/enabled submit).
 *
 * Mocks: useAppSettings, the TipTap editors, emailTemplatesApi, useAuth +
 * useApiClient, next/navigation, next-intl, next/link.
 */

vi.mock("next-intl", () => {
  const translate = (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key;
  return { useTranslations: () => translate };
});

const push = vi.fn();
const router = { push, replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
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

// REQ-086: configurable AppSettings hook (the race-guard surface).
const appSettingsState = {
  settings: { applicationName: "IAB Connect" },
  isLoading: false,
};
vi.mock("@/components/providers/AppSettingsProvider", () => ({
  useAppSettings: () => appSettingsState,
}));

// TipTap editors are jsdom-hostile — trivial stubs that expose the onChange seam.
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
vi.mock("@/features/communication/email-templates/api/email-templates", () => ({
  emailTemplatesApi: {
    getAllTemplates: (...args: unknown[]) => getAllTemplates(...args),
    getTemplateById: (...args: unknown[]) => getTemplateById(...args),
  },
}));

import NewEmailCampaignPage from "./page";

// Per-test transport state.
let segmentsPayload: { id: string; name: string; segmentType: string }[];
let createOk: boolean;
let createId: string;
let createError: string | null;

function findCreateCall() {
  return apiClient.post.mock.calls.find(
    (c) => c[0] === "/api/v1/email-campaigns"
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

  segmentsPayload = [];
  createOk = true;
  createId = "new-1";
  createError = null;

  getAllTemplates.mockResolvedValue([]);
  getTemplateById.mockResolvedValue({
    subject: "Tmpl subject",
    htmlContent: "<p>tmpl</p>",
    textContent: "tmpl",
  });

  // GET /member-segments/active (folded segment dropdown load).
  apiClient.get.mockImplementation(() =>
    Promise.resolve({ data: segmentsPayload, error: null, status: 200 })
  );
  // POST /api/v1/email-campaigns (create).
  apiClient.post.mockImplementation(() =>
    Promise.resolve(
      createOk
        ? { data: { id: createId }, error: null, status: 201 }
        : { data: null, error: createError, status: 400 }
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
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NewEmailCampaignPage />
    </QueryClientProvider>
  );
}

describe("NewEmailCampaignPage (create form) — characterization (current behaviour)", () => {
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

  it("renders the create form heading for a Vorstand user", async () => {
    renderPage();

    expect(await screen.findByText("form.newTitle")).toBeInTheDocument();
  });

  // --- segment-type select uses the HARDCODED German labels (getSegmentTypeLabel) ---

  it("renders the recipient-group select with the hardcoded German segment labels", async () => {
    renderPage();
    await screen.findByText("form.newTitle");

    expect(screen.getByText("Alle aktiven Mitglieder")).toBeInTheDocument();
    expect(screen.getByText("Mitglieder-Segment")).toBeInTheDocument();
    expect(screen.getByText("Benutzerdefiniert")).toBeInTheDocument();
  });

  // --- template dropdown only when templates exist ---

  it("does not render the template selector when no active templates exist", async () => {
    getAllTemplates.mockResolvedValue([]);

    renderPage();
    await screen.findByText("form.newTitle");

    expect(screen.queryByText("form.loadFromTemplate")).not.toBeInTheDocument();
  });

  it("renders the template selector with active templates and loads one on select", async () => {
    getAllTemplates.mockResolvedValue([
      { id: 7, name: "Welcome", category: "Onboarding", isActive: true },
      { id: 8, name: "Inactive", isActive: false },
    ]);

    renderPage();
    await screen.findByText("form.newTitle");

    expect(
      await screen.findByText("form.loadFromTemplate")
    ).toBeInTheDocument();
    // only the active template option is present
    expect(screen.getByText("Welcome (Onboarding)")).toBeInTheDocument();
    expect(screen.queryByText("Inactive")).not.toBeInTheDocument();

    // selecting it loads via getTemplateById and fills the subject
    const templateSelect = document.getElementById(
      "templateSelect"
    ) as HTMLSelectElement;
    fireEvent.change(templateSelect, { target: { value: "7" } });

    await waitFor(() => expect(getTemplateById).toHaveBeenCalledWith(7, "tok"));
    await waitFor(() =>
      expect(
        (
          screen.getByPlaceholderText(
            "form.subjectPlaceholder"
          ) as HTMLInputElement
        ).value
      ).toBe("Tmpl subject")
    );
  });

  // --- member-segments loaded for the dropdown when MemberSegment is chosen ---

  it("loads member segments and shows them in the segment search dropdown", async () => {
    segmentsPayload = [
      { id: "s1", name: "VIP Members", segmentType: "Dynamic" },
    ];

    renderPage();
    await screen.findByText("form.newTitle");
    await waitFor(() =>
      expect(
        apiClient.get.mock.calls.some((c) =>
          (c[0] as string).includes("/member-segments/active")
        )
      ).toBe(true)
    );

    // switch the recipient group to MemberSegment
    const segmentTypeSelect = screen.getByDisplayValue(
      "Alle aktiven Mitglieder"
    );
    fireEvent.change(segmentTypeSelect, { target: { value: "MemberSegment" } });

    // focus the search to open the dropdown
    const search = screen.getByPlaceholderText("form.searchSegmentPlaceholder");
    fireEvent.focus(search);

    expect(await screen.findByText("VIP Members")).toBeInTheDocument();
  });

  // --- editor mode toggle swaps the visual / html editor ---

  it("toggles between the visual and html editors", async () => {
    renderPage();
    await screen.findByText("form.newTitle");

    expect(screen.getByTestId("rich-text-editor")).toBeInTheDocument();
    expect(screen.queryByTestId("html-source-editor")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /form\.htmlMode/ }));

    expect(screen.getByTestId("html-source-editor")).toBeInTheDocument();
    expect(screen.queryByTestId("rich-text-editor")).not.toBeInTheDocument();
  });

  // --- submit POSTs the formData then navigates to the detail page ---

  it("submits the form, POSTs to /api/v1/email-campaigns, then navigates to the new detail page", async () => {
    createId = "new-42";

    renderPage();
    await screen.findByText("form.newTitle");

    fireEvent.change(
      screen.getByPlaceholderText("form.campaignNamePlaceholder"),
      {
        target: { value: "My Campaign" },
      }
    );
    fireEvent.change(screen.getByPlaceholderText("form.subjectPlaceholder"), {
      target: { value: "My Subject" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "form.createCampaign" })
    );

    await waitFor(() => expect(findCreateCall()).toBeTruthy());
    const call = findCreateCall()!;
    // A88: api.post is called with (endpoint, body) — body is the object directly.
    const body = call[1] as Record<string, unknown>;
    expect(body.name).toBe("My Campaign");
    expect(body.subject).toBe("My Subject");
    expect(body.segmentType).toBe("AllActiveMembers");

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/communication/email-campaigns/new-42")
    );
  });

  it("surfaces the create error banner (server message) when the POST is not ok", async () => {
    createOk = false;
    createError = "Name already exists";

    renderPage();
    await screen.findByText("form.newTitle");

    fireEvent.change(
      screen.getByPlaceholderText("form.campaignNamePlaceholder"),
      {
        target: { value: "Dup" },
      }
    );
    fireEvent.change(screen.getByPlaceholderText("form.subjectPlaceholder"), {
      target: { value: "Subj" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "form.createCampaign" })
    );

    expect(await screen.findByText("Name already exists")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalledWith(
      expect.stringContaining("/communication/email-campaigns/")
    );
  });

  // --- REQ-086 fromName race-guard (observable outcome) ---

  it("REQ-086: defaults the sender name to settings.applicationName once settings have loaded", async () => {
    appSettingsState.settings = { applicationName: "My Org" };
    appSettingsState.isLoading = false;

    renderPage();
    await screen.findByText("form.newTitle");

    // The sender-name input (no placeholder) is the only text input whose value
    // becomes the org name. fromName defaults from applicationName when empty.
    await waitFor(() => {
      const fromName = screen
        .getAllByRole("textbox")
        .find(
          (el) => (el as HTMLInputElement).name === "fromName"
        ) as HTMLInputElement;
      expect(fromName.value).toBe("My Org");
    });
  });

  it("REQ-086: submit is disabled while settings are still loading AND fromName is empty", async () => {
    // settingsLoading true + applicationName empty → the default effect leaves
    // fromName blank → disabled={loading || (settingsLoading && !fromName.trim())}.
    appSettingsState.isLoading = true;
    appSettingsState.settings = { applicationName: "" };

    renderPage();
    await screen.findByText("form.newTitle");

    expect(
      screen.getByRole("button", { name: "form.createCampaign" })
    ).toBeDisabled();
  });

  it("REQ-086: submit is enabled once settings finish loading (fromName populated)", async () => {
    appSettingsState.isLoading = false;
    appSettingsState.settings = { applicationName: "Filled Org" };

    renderPage();
    await screen.findByText("form.newTitle");

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "form.createCampaign" })
      ).toBeEnabled()
    );
  });

  // --- auth loading lifecycle ---

  it("renders the loading spinner while auth is still loading", async () => {
    authState.isLoading = true;

    const { container } = renderPage();

    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });
});
