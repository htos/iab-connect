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
 * E25-S1: Characterization tests for the NEW automation page
 * (src/app/communication/automations/new/page.tsx) BEFORE the feature-slice
 * refactor. new/page.tsx is a thin wrapper that renders
 * <AutomationForm mode="create" />; these specs pin the create-mode behaviour
 * THROUGH that wrapper (the existing AutomationForm.test.tsx pins the form in
 * isolation; here we additionally pin the inline segment-load fetch URL +
 * the submit-error banner + the MemberSegment validation branch).
 *
 * HEAD quirks pinned:
 *  - createTitle heading rendered for mode="create".
 *  - On mount the form raw-fetches segments from
 *    `${baseUrl}/api/v1/member-segments?pageSize=100` with a Bearer header
 *    (NOT `/member-segments/active`).
 *  - clientValidate: name required, then templateId required, then offset-when-
 *    time-relative, then segmentFilter-when-MemberSegment.
 *  - submit → createAutomation(token, body) → push("/communication/automations/{id}").
 *  - createAutomation throwing surfaces an error banner (role="alert") and no
 *    navigation.
 *  - previewRecipients action fires and renders the preview count.
 */

const push = vi.fn();

vi.mock("next-intl", () => {
  const translate = (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key;
  return { useTranslations: () => translate };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    isAdmin: false,
    isVorstand: true,
    accessToken: "test-token",
  }),
}));

vi.mock("@/features/communication/email-templates/api/email-templates", () => ({
  emailTemplatesApi: {
    getAllTemplates: vi
      .fn()
      .mockResolvedValue([{ id: 1, name: "Welcome template" }]),
  },
}));

const createAutomation = vi.fn();
const updateAutomation = vi.fn();
const previewRecipients = vi.fn();
vi.mock("@/features/communication/automations/api/automations", async () => {
  const actual = await vi.importActual<typeof import("@/features/communication/automations/api/automations")>(
    "@/features/communication/automations/api/automations"
  );
  return {
    ...actual,
    createAutomation: (...args: unknown[]) => createAutomation(...args),
    updateAutomation: (...args: unknown[]) => updateAutomation(...args),
    previewRecipients: (...args: unknown[]) => previewRecipients(...args),
  };
});

import NewAutomationPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  createAutomation.mockResolvedValue({ id: "new-id" });
  previewRecipients.mockResolvedValue({ totalCount: 3, preview: [] });
  // segment-load raw fetch — default returns two segments.
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [{ id: "seg-1", name: "Segment One" }],
          }),
      })
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
      <NewAutomationPage />
    </QueryClientProvider>
  );
}

describe("NewAutomationPage — characterization (current behaviour)", () => {
  it("renders the create form (createTitle heading + template options)", async () => {
    renderPage();

    expect(screen.getByText("createTitle")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("Welcome template")).toBeInTheDocument()
    );
  });

  it("loads segments from /api/v1/member-segments?pageSize=100 with a Bearer header", async () => {
    renderPage();

    await waitFor(() => {
      const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
      expect(fetchMock).toHaveBeenCalled();
    });
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/member-segments?pageSize=100");
    expect(
      (init as { headers: Record<string, string> }).headers.Authorization
    ).toBe("Bearer test-token");
  });

  it("blocks submit and shows the field error when the name is missing", async () => {
    renderPage();

    fireEvent.click(screen.getByText("save"));

    expect(
      await screen.findByText("validation.nameRequired")
    ).toBeInTheDocument();
    expect(createAutomation).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("requires a template once a name is present", async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("form.name"), {
      target: { value: "Welcome journey" },
    });
    fireEvent.click(screen.getByText("save"));

    expect(
      await screen.findByText("validation.templateRequired")
    ).toBeInTheDocument();
    expect(createAutomation).not.toHaveBeenCalled();
  });

  it("requires a segment when segmentType is MemberSegment", async () => {
    renderPage();
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
    expect(createAutomation).not.toHaveBeenCalled();
  });

  it("submits a valid form via createAutomation and redirects to the detail page", async () => {
    renderPage();
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

    await waitFor(() => expect(createAutomation).toHaveBeenCalledTimes(1));
    expect(createAutomation.mock.calls[0][0]).toBe("test-token");
    const body = createAutomation.mock.calls[0][1] as Record<string, unknown>;
    expect(body.name).toBe("Welcome journey");
    expect(body.templateId).toBe(1);
    expect(body.triggerType).toBe("MemberJoined");

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/communication/automations/new-id")
    );
  });

  it("surfaces an error banner when createAutomation throws and does not navigate", async () => {
    createAutomation.mockRejectedValue(new Error("Name already in use"));

    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Welcome template")).toBeInTheDocument()
    );

    fireEvent.change(screen.getByLabelText("form.name"), {
      target: { value: "Dup" },
    });
    fireEvent.change(screen.getByLabelText("form.template"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByText("save"));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Name already in use");
    expect(push).not.toHaveBeenCalled();
  });

  it("the preview action calls previewRecipients and renders the count", async () => {
    renderPage();

    fireEvent.click(screen.getByText("previewRecipients"));

    await waitFor(() => expect(previewRecipients).toHaveBeenCalledTimes(1));
    expect(previewRecipients.mock.calls[0][0]).toBe("test-token");
    await waitFor(() =>
      expect(screen.getByTestId("preview-count").textContent).toContain("3")
    );
  });
});
