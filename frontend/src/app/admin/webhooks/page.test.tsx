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

// REQ-058 (E8-S3): the webhooks page lists subscriptions, exposes event-type checkboxes, and shows
// the create-response signing secret in a show-once panel.

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPut = vi.fn();
const apiDelete = vi.fn();
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    isAdmin: true,
    accessToken: "test-token",
  }),
  useApiClient: () => ({
    get: apiGet,
    post: apiPost,
    put: apiPut,
    delete: apiDelete,
  }),
}));

import WebhooksPage from "./page";

const eventTypes = ["event.created", "payment.received"];

function mockList(subs: unknown[]) {
  apiGet.mockImplementation((endpoint: string) => {
    if (endpoint.endsWith("/event-types"))
      return Promise.resolve({ data: eventTypes, error: null, status: 200 });
    return Promise.resolve({ data: subs, error: null, status: 200 });
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("WebhooksPage", () => {
  it("lists existing subscriptions", async () => {
    mockList([
      {
        id: "1",
        name: "Partner Hook",
        targetUrl: "https://p.example.com/h",
        eventTypes: ["event.created"],
        status: "Active",
        createdAt: "2026-06-07T00:00:00Z",
        updatedAt: null,
      },
    ]);
    render(<WebhooksPage />);
    await waitFor(() =>
      expect(screen.getByText("Partner Hook")).toBeInTheDocument()
    );
  });

  it("renders event-type checkboxes in the create dialog", async () => {
    mockList([]);
    render(<WebhooksPage />);
    await waitFor(() =>
      expect(screen.getByText("noWebhooks")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByText("create"));
    await waitFor(() =>
      expect(screen.getByText("createDialogTitle")).toBeInTheDocument()
    );
    expect(screen.getByText("event.created")).toBeInTheDocument();
    expect(screen.getByText("payment.received")).toBeInTheDocument();
  });

  it("shows the signing secret exactly once after create", async () => {
    mockList([]);
    apiPost.mockResolvedValue({
      data: {
        id: "9",
        name: "New",
        targetUrl: "https://n.example.com/h",
        eventTypes: ["event.created"],
        secret: "iabc-webhook-SECRET",
        createdAt: "2026-06-07T00:00:00Z",
      },
      error: null,
      status: 201,
    });
    render(<WebhooksPage />);
    await waitFor(() =>
      expect(screen.getByText("noWebhooks")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByText("create"));
    await waitFor(() =>
      expect(screen.getByText("createDialogTitle")).toBeInTheDocument()
    );
    fireEvent.change(screen.getByPlaceholderText("namePlaceholder"), {
      target: { value: "New" },
    });
    fireEvent.change(screen.getByPlaceholderText("https://"), {
      target: { value: "https://n.example.com/h" },
    });
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByText("save"));

    await waitFor(() =>
      expect(screen.getByText("secretOnceWarning")).toBeInTheDocument()
    );
    expect(screen.getByText("iabc-webhook-SECRET")).toBeInTheDocument();
  });
});
