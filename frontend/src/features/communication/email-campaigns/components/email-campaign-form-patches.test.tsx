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
 * E25-S3 review patches — focused regression coverage.
 *
 * Patch 1 (HIGH): the header back-link is threaded through props so EDIT mode
 * points at the DETAIL page with the SINGULAR `backToCampaign` label, while CREATE
 * keeps the LIST + plural `backToCampaigns` (god-page parity — the edit god-page
 * linked to the detail, the create god-page to the list).
 *
 * Patch 2 (MED): the `noValidate` form now renders the Zod `form.required` message
 * under each empty required field on submit, and the transport gate is preserved
 * (an empty required field blocks the create POST — no `api.post`).
 *
 * Renders the REAL slice content components so the prop wiring + the create
 * mutation transport seam are exercised end-to-end (the `useApiClient` spy mirrors
 * the E25-S1 nets, A88).
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
  }: {
    content: string;
    onChange: (c: string) => void;
  }) => (
    <textarea
      data-testid="rich-text-editor"
      value={content}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  HtmlSourceEditor: ({
    content,
    onChange,
  }: {
    content: string;
    onChange: (c: string) => void;
  }) => (
    <textarea
      data-testid="html-source-editor"
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

import { EmailCampaignNewContent } from "./email-campaign-new-content";
import { EmailCampaignEditContent } from "./email-campaign-edit-content";

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
    createdById: "u1",
    createdByName: "Alice",
    createdAt: "2026-01-15T00:00:00Z",
    ...overrides,
  };
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

  getAllTemplates.mockResolvedValue([]);
  apiClient.get.mockImplementation((url: string) => {
    if (url.includes("/member-segments/active")) {
      return Promise.resolve({ data: [], error: null, status: 200 });
    }
    return Promise.resolve({
      data: makeCampaign(),
      error: null,
      status: 200,
    });
  });
  apiClient.post.mockResolvedValue({
    data: { id: "new-1" },
    error: null,
    status: 201,
  });
  apiClient.put.mockResolvedValue({ data: {}, error: null, status: 200 });
});

afterEach(cleanup);

function renderContent(node: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>
  );
}

describe("E25-S3 review patches", () => {
  // --- Patch 1: header back-link ---

  it("CREATE header back-link points to the list with the plural backToCampaigns label", async () => {
    renderContent(<EmailCampaignNewContent />);
    await screen.findByText("form.newTitle");

    const back = screen.getByText("backToCampaigns").closest("a");
    expect(back).toHaveAttribute("href", "/communication/email-campaigns");
    // the singular edit-label must NOT appear in create mode
    expect(screen.queryByText("backToCampaign")).not.toBeInTheDocument();
  });

  it("EDIT header back-link points to the detail page with the singular backToCampaign label", async () => {
    renderContent(<EmailCampaignEditContent />);
    await screen.findByText("form.editTitle");

    const back = screen.getByText("backToCampaign").closest("a");
    expect(back).toHaveAttribute("href", "/communication/email-campaigns/c1");
  });

  // --- Patch 2: required-field feedback + preserved transport gate ---

  it("CREATE: submitting with an empty required field shows form.required and fires no POST", async () => {
    renderContent(<EmailCampaignNewContent />);
    await screen.findByText("form.newTitle");

    // clear a required field (campaign name) so submit must fail validation
    fireEvent.change(
      screen.getByPlaceholderText("form.campaignNamePlaceholder"),
      { target: { value: "" } }
    );

    fireEvent.click(
      screen.getByRole("button", { name: "form.createCampaign" })
    );

    // the Zod message renders under the empty required field(s)
    const errs = await screen.findAllByText("form.required");
    expect(errs.length).toBeGreaterThan(0);
    // and the transport gate held — no create POST
    await waitFor(() =>
      expect(
        apiClient.post.mock.calls.some(
          (c) => c[0] === "/api/v1/email-campaigns"
        )
      ).toBe(false)
    );
  });
});
