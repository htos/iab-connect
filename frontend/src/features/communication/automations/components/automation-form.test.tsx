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

/**
 * E25-S2 form sub-recipe (DEC-2 = RHF+Zod): focused tests for the shared
 * `AutomationForm`. Mirrors `sponsor-form.test.tsx`. Pins the NEW behaviour the
 * refactor introduces (the A79 delta): Zod required-field validation blocks
 * submit (name/template/offset-when-time-relative/segment-when-MemberSegment),
 * the API-error banner, the pending/save state, the valid-submit body, and the
 * "Preview recipients" action. The S1 new/edit suites still cover create/update →
 * redirect end-to-end through the route pages.
 *
 * These also carry forward the meaningful assertions from the now-deleted
 * `app/communication/automations/AutomationForm.test.tsx` (which tested the old
 * manual-useState component).
 */

vi.mock("next-intl", () => {
  const translate = (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key;
  return { useTranslations: () => translate };
});

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ accessToken: "test-token" }),
}));

vi.mock("@/lib/email-templates", () => ({
  emailTemplatesApi: {
    getAllTemplates: vi
      .fn()
      .mockResolvedValue([{ id: 1, name: "Welcome template" }]),
  },
}));

const previewRecipients = vi
  .fn()
  .mockResolvedValue({ totalCount: 3, preview: [] });
vi.mock("@/lib/api/automations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/automations")>(
    "@/lib/api/automations"
  );
  return {
    ...actual,
    previewRecipients: (...args: unknown[]) => previewRecipients(...args),
  };
});

import { AutomationForm, buildDefaultValues } from "./automation-form";
import type { AutomationFormValues } from "../schemas/automation.schema";

const EMPTY: AutomationFormValues = buildDefaultValues();

function renderForm(
  props: Partial<React.ComponentProps<typeof AutomationForm>> = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AutomationForm
        mode="create"
        defaultValues={EMPTY}
        onSubmit={vi.fn()}
        pending={false}
        errorMessage={null}
        {...props}
      />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  previewRecipients.mockClear();
  previewRecipients.mockResolvedValue({ totalCount: 3, preview: [] });
  // segment-load raw fetch (fetchMemberSegments) — default returns no segments.
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ items: [] }) })
    )
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AutomationForm (form sub-recipe)", () => {
  it("renders the create form (createTitle + template options)", async () => {
    renderForm();
    expect(screen.getByText("createTitle")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("Welcome template")).toBeInTheDocument()
    );
  });

  it("renders the API error banner when errorMessage is set", () => {
    renderForm({ errorMessage: "Name already in use" });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Name already in use");
  });

  it("disables the submit button and shows the saving label while pending", () => {
    renderForm({ pending: true });
    expect(screen.getByRole("button", { name: "saving" })).toBeDisabled();
  });

  it("blocks submit and shows the name-required error when name is empty (Zod)", async () => {
    const onSubmit = vi.fn();
    renderForm({ onSubmit });

    fireEvent.click(screen.getByText("save"));

    expect(
      await screen.findByText("validation.nameRequired")
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("requires a template once a name is present (Zod)", async () => {
    const onSubmit = vi.fn();
    renderForm({ onSubmit });

    fireEvent.change(screen.getByLabelText("form.name"), {
      target: { value: "Welcome journey" },
    });
    fireEvent.click(screen.getByText("save"));

    expect(
      await screen.findByText("validation.templateRequired")
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("requires an offset for time-relative triggers (Zod)", async () => {
    const onSubmit = vi.fn();
    renderForm({ onSubmit });
    await waitFor(() =>
      expect(screen.getByText("Welcome template")).toBeInTheDocument()
    );

    fireEvent.change(screen.getByLabelText("form.name"), {
      target: { value: "Reminder" },
    });
    fireEvent.change(screen.getByLabelText("form.template"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("form.trigger"), {
      target: { value: "EventUpcoming" },
    });
    fireEvent.click(screen.getByText("save"));

    expect(
      await screen.findByText("validation.offsetRequired")
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("requires a segment when segmentType is MemberSegment (Zod)", async () => {
    const onSubmit = vi.fn();
    renderForm({ onSubmit });
    await waitFor(() =>
      expect(screen.getByText("Welcome template")).toBeInTheDocument()
    );

    fireEvent.change(screen.getByLabelText("form.name"), {
      target: { value: "Targeted blast" },
    });
    fireEvent.change(screen.getByLabelText("form.template"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("form.recipients"), {
      target: { value: "MemberSegment" },
    });
    fireEvent.click(screen.getByText("save"));

    expect(
      await screen.findByText("validation.segmentRequired")
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onSubmit with the mapped request body for a valid form", async () => {
    const onSubmit = vi.fn();
    renderForm({ onSubmit });
    await waitFor(() =>
      expect(screen.getByText("Welcome template")).toBeInTheDocument()
    );

    fireEvent.change(screen.getByLabelText("form.name"), {
      target: { value: "Welcome journey" },
    });
    fireEvent.change(screen.getByLabelText("form.template"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByText("save"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const body = onSubmit.mock.calls[0][0] as Record<string, unknown>;
    expect(body.name).toBe("Welcome journey");
    expect(body.templateId).toBe(1);
    expect(body.triggerType).toBe("MemberJoined");
  });

  it("the preview action calls previewRecipients and renders the count", async () => {
    renderForm();

    fireEvent.click(screen.getByText("previewRecipients"));

    await waitFor(() => expect(previewRecipients).toHaveBeenCalledTimes(1));
    expect(previewRecipients.mock.calls[0][0]).toBe("test-token");
    await waitFor(() =>
      expect(screen.getByTestId("preview-count").textContent).toContain("3")
    );
  });

  // Patch 1 (round-trip regression): an automation whose stored segment/consent
  // is OUTSIDE the 3-option select subset (the broader transport enums) must be
  // re-submitted byte-identical on a no-touch save — god-page parity (the old
  // component held the raw value in state). The schema accepts the full transport
  // union and the select renders an extra option so the native select keeps the
  // value instead of resetting it to "".
  it("round-trips an out-of-set segmentType/consentFilter unchanged on a no-touch save", async () => {
    const onSubmit = vi.fn();
    const defaults = buildDefaultValues({
      id: "abc",
      name: "Targeted journey",
      description: null,
      status: "Draft",
      trigger: { type: "MemberJoined", offsetDays: null },
      templateId: 1,
      templateName: "Welcome template",
      // Both values are valid transport values that the form select does NOT
      // offer (EventParticipants ∈ RecipientSegmentType, DataProcessing ∈
      // ConsentType — neither is in SEGMENT_TYPES/CONSENT_TYPES).
      segmentType: "EventParticipants",
      segmentFilter: null,
      consentFilter: "DataProcessing",
      createdByName: "tester",
      createdAt: "2026-06-06T10:00:00Z",
      updatedAt: null,
    } as Parameters<typeof buildDefaultValues>[0]);

    renderForm({ mode: "edit", defaultValues: defaults, onSubmit });
    await waitFor(() =>
      expect(screen.getByText("Welcome template")).toBeInTheDocument()
    );

    // Submit WITHOUT touching the segment or consent selects.
    fireEvent.click(screen.getByText("save"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const body = onSubmit.mock.calls[0][0] as Record<string, unknown>;
    expect(body.segmentType).toBe("EventParticipants");
    expect(body.consentFilter).toBe("DataProcessing");
  });
});
