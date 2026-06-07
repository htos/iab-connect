// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// REQ-058 (E8-S4) AC-3/5: the delivery-history page renders metadata rows and never the payload body.

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
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    isAdmin: true,
    accessToken: "test-token",
  }),
  useApiClient: () => ({ get: apiGet }),
}));

import WebhookDeliveriesPage from "./page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("WebhookDeliveriesPage", () => {
  it("renders delivery rows with status + code, no payload body", async () => {
    apiGet.mockResolvedValue({
      data: {
        items: [
          {
            id: "1",
            subscriptionId: "s1",
            eventType: "event.created",
            targetUrl: "https://p.example.com/h",
            status: "Delivered",
            attemptCount: 1,
            responseStatusCode: 200,
            error: null,
            createdAt: "2026-06-07T00:00:00Z",
            lastAttemptAt: "2026-06-07T00:00:01Z",
            nextRetryAt: null,
          },
        ],
        totalCount: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
      error: null,
      status: 200,
    });

    render(<WebhookDeliveriesPage />);
    await waitFor(() =>
      expect(screen.getByText("event.created")).toBeInTheDocument()
    );
    expect(screen.getByText("Delivered")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
    // No payload column / body is rendered.
    expect(screen.queryByText(/payload/i)).not.toBeInTheDocument();
  });

  it("shows empty state when there are no deliveries", async () => {
    apiGet.mockResolvedValue({
      data: {
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
      error: null,
      status: 200,
    });
    render(<WebhookDeliveriesPage />);
    await waitFor(() =>
      expect(screen.getByText("noDeliveries")).toBeInTheDocument()
    );
  });
});
