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

/**
 * E25-S3: behaviour invariants of the shared RHF+Zod `EmailCampaignForm` (DEC-2).
 * Pins the segment-type hardcoded German labels, the MemberSegment search +
 * Custom conditional fields, the visual/html editor toggle (reusing the shared
 * editors — here stubbed), the template load-in dropdown, and the
 * values→request mapping on submit. The page-level REQ-086 race-guard + auth
 * gate live in the new/edit content (covered by the S1 app-page nets).
 */

vi.mock("next-intl", () => {
  const translate = (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key;
  return { useTranslations: () => translate };
});

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

const apiSpy = vi.hoisted(() => ({
  get: vi.fn<
    (
      url: string
    ) => Promise<{ data: unknown; error: string | null; status: number }>
  >(() => Promise.resolve({ data: [], error: null, status: 200 })),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  upload: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  useApiClient: () => apiSpy,
  useAuth: () => ({ accessToken: "tok" }),
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

import { EmailCampaignForm } from "./email-campaign-form";
import type { EmailCampaignFormValues } from "../schemas/email-campaign.schema";

const DEFAULTS: EmailCampaignFormValues = {
  name: "",
  subject: "",
  htmlContent: "",
  plainTextContent: "",
  fromName: "Club",
  fromEmail: "club@example.org",
  replyToEmail: "",
  segmentType: "AllActiveMembers",
  segmentFilter: "",
};

beforeEach(() => {
  vi.clearAllMocks();
  getAllTemplates.mockResolvedValue([]);
  apiSpy.get.mockResolvedValue({ data: [], error: null, status: 200 });
});

afterEach(cleanup);

function renderForm(
  props: Partial<React.ComponentProps<typeof EmailCampaignForm>> = {}
) {
  const onSubmit = vi.fn();
  render(
    <EmailCampaignForm
      mode="create"
      defaultValues={DEFAULTS}
      onSubmit={onSubmit}
      pending={false}
      errorMessage={null}
      cancelHref="/communication/email-campaigns"
      backHref="/communication/email-campaigns"
      backLabelKey="backToCampaigns"
      {...props}
    />
  );
  return { onSubmit };
}

describe("EmailCampaignForm", () => {
  it("renders the recipient-group select with the hardcoded German labels", () => {
    renderForm();
    expect(screen.getByText("Alle aktiven Mitglieder")).toBeInTheDocument();
    expect(screen.getByText("Mitglieder-Segment")).toBeInTheDocument();
    expect(screen.getByText("Benutzerdefiniert")).toBeInTheDocument();
  });

  it("toggles between the visual and html editors", () => {
    renderForm();
    expect(screen.getByTestId("rich-text-editor")).toBeInTheDocument();
    expect(screen.queryByTestId("html-source-editor")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /form\.htmlMode/ }));
    expect(screen.getByTestId("html-source-editor")).toBeInTheDocument();
    expect(screen.queryByTestId("rich-text-editor")).not.toBeInTheDocument();
  });

  it("reveals the Custom free-text filter when Custom is selected", () => {
    renderForm();
    const select = screen.getByDisplayValue("Alle aktiven Mitglieder");
    fireEvent.change(select, { target: { value: "Custom" } });
    expect(
      screen.getByPlaceholderText("form.customFilterPlaceholder")
    ).toBeInTheDocument();
  });

  it("reveals the MemberSegment search input when MemberSegment is selected", async () => {
    apiSpy.get.mockResolvedValue({
      data: [{ id: "s1", name: "VIP", segmentType: "Dynamic" }],
      error: null,
      status: 200,
    });
    renderForm();
    const select = screen.getByDisplayValue("Alle aktiven Mitglieder");
    fireEvent.change(select, { target: { value: "MemberSegment" } });
    const search = screen.getByPlaceholderText("form.searchSegmentPlaceholder");
    fireEvent.focus(search);
    expect(await screen.findByText("VIP")).toBeInTheDocument();
  });

  it("maps the form values to the request body on submit", async () => {
    const { onSubmit } = renderForm();
    fireEvent.change(
      screen.getByPlaceholderText("form.campaignNamePlaceholder"),
      { target: { value: "My Campaign" } }
    );
    fireEvent.change(screen.getByPlaceholderText("form.subjectPlaceholder"), {
      target: { value: "My Subject" },
    });
    fireEvent.change(screen.getByTestId("rich-text-editor"), {
      target: { value: "<p>body</p>" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "form.createCampaign" })
    );

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: "My Campaign",
      subject: "My Subject",
      htmlContent: "<p>body</p>",
      segmentType: "AllActiveMembers",
    });
  });

  it("renders the template dropdown only when active templates exist", async () => {
    getAllTemplates.mockResolvedValue([
      { id: 7, name: "Welcome", category: "Onboarding", isActive: true },
      { id: 8, name: "Inactive", isActive: false },
    ]);
    renderForm();
    expect(
      await screen.findByText("form.loadFromTemplate")
    ).toBeInTheDocument();
    expect(screen.getByText("Welcome (Onboarding)")).toBeInTheDocument();
    expect(screen.queryByText("Inactive")).not.toBeInTheDocument();
  });
});
