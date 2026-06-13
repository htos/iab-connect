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
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// REQ-058 (E8-S3): the webhooks page lists subscriptions, exposes event-type checkboxes, and shows
// the create-response signing secret in a show-once panel.
//
// E27-S1 (characterization / regression net): extends the original net with the admin guard
// (AC-1), enable/disable toggle, delete (confirm + DELETE, red affordance), edit via the shared
// dialog (PUT, no secret), the eventTypes round-trip on a no-touch edit, the save-disabled gate,
// and the AC-8 destructive-colour + failure-branch pins. Pins CURRENT behaviour AS-IS.
//
// A79 deltas: useApiClient runs with `retry: false` at the transport boundary; these tests stub
// the api hook directly (no fetch/retry layer), so no retry-masked deltas are observable here.
//
// Reality divergences from AC text (pinned as the real code):
//  - There is NO "regenerate secret" action anywhere. The signing secret is shown ONLY on create;
//    edit (PUT) never returns or displays a secret. (Asserted below.)
//  - The toggle action is derived purely from `status === "Active"` (-> "disable", else "enable")
//    and runs with NO confirm dialog. Delete is the only action behind window.confirm.
//  - The guard target is "/" (NOT "/login").

// HARNESS NOTE (E27-S1): module-level stable translator (not a fresh arrow per render).
const tFn = (key: string) => key;
vi.mock("next-intl", () => ({ useTranslations: () => tFn }));

// Stable router mock so the admin-guard push() target is observable across renders.
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mutable auth state so the admin guard can be exercised. Defaults to an authenticated admin.
const authState = {
  isAuthenticated: true,
  isLoading: false,
  isAdmin: true,
  accessToken: "test-token" as string | undefined,
};
const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPut = vi.fn();
const apiDelete = vi.fn();
// Stable api object identity across renders. The page's load effect lists `api` as a dependency,
// so a fresh object each render would retrigger the initial fetch on every render and make
// refetch-count assertions non-deterministic (mirrors the real useApiClient's useMemo identity).
const apiClient = {
  get: apiGet,
  post: apiPost,
  put: apiPut,
  delete: apiDelete,
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => apiClient,
}));

import WebhooksPage from "./page";

// E27-S5 feature-slice adaptation (A88, mirrors the E25-S3 admission): the page now
// routes through the `features/admin-integrations` slice, whose hooks use TanStack
// Query. The ONLY harness change is wrapping the render in a `QueryClientProvider`
// (retry:false) — the `@/lib/auth` mock seam is unchanged and EVERY behavioural
// assertion below is preserved verbatim (including the no-touch eventTypes round-trip,
// the create-only show-once secret, and the delete/disable failure no-refetch pins).
function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <WebhooksPage />
    </QueryClientProvider>
  );
}

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
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.isAdmin = true;
  authState.accessToken = "test-token";
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
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Partner Hook")).toBeInTheDocument()
    );
  });

  it("renders event-type checkboxes in the create dialog", async () => {
    mockList([]);
    renderPage();
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
    renderPage();
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

  // --- E27-S1 added: admin guard (AC-1) ---

  it("redirects a non-admin to / and does not fetch", async () => {
    authState.isAdmin = false;
    mockList([]);
    renderPage();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("redirects an unauthenticated user to / and does not fetch", async () => {
    authState.isAuthenticated = false;
    mockList([]);
    renderPage();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("does not fetch when the access token is missing", async () => {
    authState.accessToken = undefined;
    mockList([]);
    renderPage();
    await waitFor(() => {});
    expect(push).not.toHaveBeenCalled();
    expect(apiGet).not.toHaveBeenCalled();
  });

  // --- E27-S1 added: enable/disable toggle (no confirm) ---

  it("disables an Active subscription via POST .../{id}/disable with no confirm", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    mockList([
      {
        id: "1",
        name: "Active Hook",
        targetUrl: "https://p.example.com/h",
        eventTypes: ["event.created"],
        status: "Active",
        createdAt: "2026-06-07T00:00:00Z",
        updatedAt: null,
      },
    ]);
    apiPost.mockResolvedValue({ data: {}, error: null, status: 200 });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Active Hook")).toBeInTheDocument()
    );

    // Toggle button is labelled "disable" while Active.
    fireEvent.click(screen.getByLabelText("disable"));
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/admin/webhooks/1/disable",
        {}
      )
    );
    // No confirm gate on the toggle.
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("enables a Disabled subscription via POST .../{id}/enable", async () => {
    mockList([
      {
        id: "2",
        name: "Disabled Hook",
        targetUrl: "https://p.example.com/h",
        eventTypes: ["event.created"],
        status: "Disabled",
        createdAt: "2026-06-07T00:00:00Z",
        updatedAt: null,
      },
    ]);
    apiPost.mockResolvedValue({ data: {}, error: null, status: 200 });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Disabled Hook")).toBeInTheDocument()
    );

    // Toggle button is labelled "enable" while Disabled; status cell shows "disabled".
    expect(screen.getByText("disabled")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("enable"));
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/admin/webhooks/2/enable",
        {}
      )
    );
  });

  // --- E27-S1 added: delete (confirm -> DELETE, red affordance) ---

  it("deletes a subscription after confirm via DELETE .../{id}", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    mockList([
      {
        id: "1",
        name: "Doomed Hook",
        targetUrl: "https://p.example.com/h",
        eventTypes: ["event.created"],
        status: "Active",
        createdAt: "2026-06-07T00:00:00Z",
        updatedAt: null,
      },
    ]);
    apiDelete.mockResolvedValue({ data: {}, error: null, status: 204 });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Doomed Hook")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByLabelText("delete"));
    await waitFor(() =>
      expect(apiDelete).toHaveBeenCalledWith("/api/v1/admin/webhooks/1")
    );
    expect(confirmSpy).toHaveBeenCalledWith("confirmDelete");
    confirmSpy.mockRestore();
  });

  it("does not delete when confirm is cancelled", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    mockList([
      {
        id: "1",
        name: "Doomed Hook",
        targetUrl: "https://p.example.com/h",
        eventTypes: ["event.created"],
        status: "Active",
        createdAt: "2026-06-07T00:00:00Z",
        updatedAt: null,
      },
    ]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Doomed Hook")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByLabelText("delete"));
    expect(apiDelete).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  // --- E27-S1 added: AC-8 pin the destructive colour + failure branch ---

  it("renders the delete action with the red destructive colour (not a generic destructive variant)", async () => {
    mockList([
      {
        id: "1",
        name: "Hook",
        targetUrl: "https://p.example.com/h",
        eventTypes: ["event.created"],
        status: "Active",
        createdAt: "2026-06-07T00:00:00Z",
        updatedAt: null,
      },
    ]);
    renderPage();
    await waitFor(() => expect(screen.getByText("Hook")).toBeInTheDocument());
    const deleteBtn = screen.getByLabelText("delete");
    expect(deleteBtn).toHaveClass("text-red-600");
    expect(deleteBtn).toHaveClass("hover:text-red-800");
  });

  it("surfaces the error and does not refetch when delete fails", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    mockList([
      {
        id: "1",
        name: "Hook",
        targetUrl: "https://p.example.com/h",
        eventTypes: ["event.created"],
        status: "Active",
        createdAt: "2026-06-07T00:00:00Z",
        updatedAt: null,
      },
    ]);
    apiDelete.mockResolvedValue({
      data: null,
      error: "delete boom",
      status: 500,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Hook")).toBeInTheDocument());

    apiGet.mockClear(); // only count refetches after this point
    fireEvent.click(screen.getByLabelText("delete"));
    await waitFor(() =>
      expect(screen.getByText("delete boom")).toBeInTheDocument()
    );
    // Failure branch: NO list refetch is issued.
    expect(apiGet).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("surfaces the error and does not refetch when disable fails", async () => {
    mockList([
      {
        id: "1",
        name: "Hook",
        targetUrl: "https://p.example.com/h",
        eventTypes: ["event.created"],
        status: "Active",
        createdAt: "2026-06-07T00:00:00Z",
        updatedAt: null,
      },
    ]);
    apiPost.mockResolvedValue({
      data: null,
      error: "disable boom",
      status: 500,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Hook")).toBeInTheDocument());

    apiGet.mockClear();
    fireEvent.click(screen.getByLabelText("disable"));
    await waitFor(() =>
      expect(screen.getByText("disable boom")).toBeInTheDocument()
    );
    expect(apiGet).not.toHaveBeenCalled();
  });

  // --- E27-S1 added: edit via shared dialog (PUT, NO secret shown) ---

  it("edits a subscription via PUT .../{id} and never shows a secret on edit", async () => {
    mockList([
      {
        id: "5",
        name: "Editable Hook",
        targetUrl: "https://e.example.com/h",
        eventTypes: ["event.created"],
        status: "Active",
        createdAt: "2026-06-07T00:00:00Z",
        updatedAt: null,
      },
    ]);
    apiPut.mockResolvedValue({ data: {}, error: null, status: 200 });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Editable Hook")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByLabelText("edit"));
    await waitFor(() =>
      expect(screen.getByText("editDialogTitle")).toBeInTheDocument()
    );
    // Dialog pre-fills the existing name + targetUrl.
    expect(screen.getByDisplayValue("Editable Hook")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("https://e.example.com/h")
    ).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("namePlaceholder"), {
      target: { value: "Renamed Hook" },
    });
    fireEvent.click(screen.getByText("save"));

    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith("/api/v1/admin/webhooks/5", {
        name: "Renamed Hook",
        targetUrl: "https://e.example.com/h",
        eventTypes: ["event.created"],
      })
    );
    // No create POST, and crucially NO show-once secret panel on the edit path.
    expect(apiPost).not.toHaveBeenCalled();
    expect(screen.queryByText("secretOnceWarning")).not.toBeInTheDocument();
  });

  it("round-trips stored eventTypes on a no-touch edit even when not in availableEventTypes", async () => {
    // The stored subscription has a legacy event type that is NOT offered as a checkbox.
    // openEdit() seeds selectedTypes from sub.eventTypes, so an untouched save must PUT it back.
    mockList([
      {
        id: "6",
        name: "Legacy Hook",
        targetUrl: "https://legacy.example.com/h",
        eventTypes: ["legacy.retired.type"],
        status: "Active",
        createdAt: "2026-06-07T00:00:00Z",
        updatedAt: null,
      },
    ]);
    apiPut.mockResolvedValue({ data: {}, error: null, status: 200 });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Legacy Hook")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByLabelText("edit"));
    await waitFor(() =>
      expect(screen.getByText("editDialogTitle")).toBeInTheDocument()
    );
    // The legacy type is NOT offered as a checkbox (only availableEventTypes are rendered as
    // checkboxes). Only the two known types appear as <code> checkbox labels inside the dialog.
    const checkboxLabels = screen.getAllByRole("checkbox");
    expect(checkboxLabels).toHaveLength(eventTypes.length);

    // Save without touching the event-type selection.
    fireEvent.click(screen.getByText("save"));
    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith("/api/v1/admin/webhooks/6", {
        name: "Legacy Hook",
        targetUrl: "https://legacy.example.com/h",
        eventTypes: ["legacy.retired.type"],
      })
    );
  });

  // --- E27-S1 added: save-disabled gate (name + targetUrl + >=1 event type) ---

  it("keeps save disabled until name, targetUrl and >=1 event type are all set", async () => {
    mockList([]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("noWebhooks")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByText("create"));
    await waitFor(() =>
      expect(screen.getByText("createDialogTitle")).toBeInTheDocument()
    );

    const saveBtn = screen.getByText("save").closest("button")!;
    expect(saveBtn).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("namePlaceholder"), {
      target: { value: "New" },
    });
    expect(saveBtn).toBeDisabled(); // still missing targetUrl + event type

    fireEvent.change(screen.getByPlaceholderText("https://"), {
      target: { value: "https://n.example.com/h" },
    });
    expect(saveBtn).toBeDisabled(); // still missing >=1 event type

    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(saveBtn).toBeEnabled(); // now all three constraints are satisfied
  });
});
