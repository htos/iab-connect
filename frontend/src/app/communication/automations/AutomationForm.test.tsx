// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// REQ-028 (E5-S3) AC-7: form rendering + validation + submit + recipient preview.

const pushMock = vi.fn();

// next-intl: STABLE identity translator (A64 — the form has no t-in-deps effect, but keep it
// stable to match the project convention and avoid surprises).
vi.mock("next-intl", () => {
  const translate = (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key;
  return { useTranslations: () => translate };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), refresh: vi.fn() }),
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

vi.mock("@/lib/email-templates", () => ({
  emailTemplatesApi: {
    getAllTemplates: vi
      .fn()
      .mockResolvedValue([{ id: 1, name: "Welcome template" }]),
  },
}));

const createAutomation = vi.fn().mockResolvedValue({ id: "new-id" });
const previewRecipients = vi
  .fn()
  .mockResolvedValue({ totalCount: 3, preview: [] });

vi.mock("@/lib/api/automations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/automations")>(
    "@/lib/api/automations"
  );
  return {
    ...actual,
    createAutomation: (...args: unknown[]) => createAutomation(...args),
    updateAutomation: vi.fn(),
    previewRecipients: (...args: unknown[]) => previewRecipients(...args),
  };
});

import AutomationForm from "./AutomationForm";

beforeEachFetchStub();
function beforeEachFetchStub() {
  // segments fetch
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ items: [] }),
  }) as unknown as typeof fetch;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  beforeEachFetchStub();
});

describe("AutomationForm", () => {
  it("renders the create form with template options", async () => {
    render(<AutomationForm mode="create" />);
    expect(screen.getByText("createTitle")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("Welcome template")).toBeInTheDocument()
    );
  });

  it("blocks submit and shows a field error when required fields are missing", async () => {
    render(<AutomationForm mode="create" />);
    fireEvent.click(screen.getByText("save"));
    await waitFor(() =>
      expect(screen.getByText("validation.nameRequired")).toBeInTheDocument()
    );
    expect(createAutomation).not.toHaveBeenCalled();
  });

  it("submits a valid form via createAutomation", async () => {
    render(<AutomationForm mode="create" />);
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
    const body = createAutomation.mock.calls[0][1];
    expect(body.name).toBe("Welcome journey");
    expect(body.templateId).toBe(1);
    expect(body.triggerType).toBe("MemberJoined");
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/communication/automations/new-id")
    );
  });

  it("requires an offset for time-relative triggers", async () => {
    render(<AutomationForm mode="create" />);
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

    await waitFor(() =>
      expect(screen.getByText("validation.offsetRequired")).toBeInTheDocument()
    );
    expect(createAutomation).not.toHaveBeenCalled();
  });

  it("renders the server-computed recipient preview count", async () => {
    render(<AutomationForm mode="create" />);
    fireEvent.click(screen.getByText("previewRecipients"));
    await waitFor(() => expect(previewRecipients).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByTestId("preview-count").textContent).toContain("3")
    );
  });
});
