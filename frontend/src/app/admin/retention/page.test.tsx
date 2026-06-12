// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// E27-S1 characterization tests (regression net) for the Retention Policies admin page.
// Pins CURRENT observable behaviour at HEAD. No production code changed.
// The page consumes the @/lib/api/retention transport directly with the access token
// (NOT useApiClient). We mock the transport functions at the boundary and keep the
// real getActionColor so badge className assertions pin the real colour logic.
//
// A79 deltas: this page does NOT use TanStack Query; data is fetched via
// useState/useEffect, so `retry:false` masks nothing. The success message uses a
// 5s auto-dismiss setTimeout(... , 5000); we pin that timer with fake timers (see
// "success toast auto-dismiss"): the message renders after save and is removed
// after advancing virtual time by 5s.

// A64: STABLE identity translation function. fetchPolicies depends on `t` and feeds
// an effect dependency array; an unstable `t` (new arrow each render) causes spurious
// refetch loops. A hoisted stable identity fn mirrors production (next-intl memoizes).
const tFn = (key: string) => key;
vi.mock("next-intl", () => ({ useTranslations: () => tFn }));
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const authState = {
  isAuthenticated: true,
  isLoading: false,
  isAdmin: true,
  accessToken: "test-token",
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => ({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
  }),
}));

const getRetentionPolicies = vi.fn();
const updateRetentionPolicy = vi.fn();
const enforceRetention = vi.fn();
vi.mock("@/lib/api/retention", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/retention")>(
    "@/lib/api/retention"
  );
  return {
    ...actual,
    getRetentionPolicies: (...a: unknown[]) => getRetentionPolicies(...a),
    updateRetentionPolicy: (...a: unknown[]) => updateRetentionPolicy(...a),
    enforceRetention: (...a: unknown[]) => enforceRetention(...a),
  };
});

import RetentionPage from "./page";

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

// The retention edit-form labels are NOT wired to their controls via htmlFor/id, so
// getByLabelText does not work. This helper finds a field's control by locating the
// label text and reading the control inside the same wrapping <div>.
function controlForLabel(labelText: string): HTMLElement {
  const label = screen.getByText(labelText);
  const wrapper = label.parentElement as HTMLElement;
  const control = wrapper.querySelector("select, input, textarea");
  if (!control) throw new Error(`No control found for label '${labelText}'`);
  return control as HTMLElement;
}

function makePolicy(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    dataCategory: "member_data",
    displayName: "Member Data",
    retentionMonths: 24,
    action: "Anonymize",
    legalBasis: "DSG Art. 6",
    isActive: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  getRetentionPolicies.mockResolvedValue([makePolicy()]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isAdmin = true;
  authState.accessToken = "test-token";
});

describe("RetentionPage — AC-1 guard", () => {
  it("redirects non-admin users to '/'", async () => {
    authState.isAdmin = false;
    renderWithClient(<RetentionPage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("redirects unauthenticated users to '/'", async () => {
    authState.isAuthenticated = false;
    renderWithClient(<RetentionPage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("does not fetch policies when not admin", async () => {
    authState.isAdmin = false;
    renderWithClient(<RetentionPage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(getRetentionPolicies).not.toHaveBeenCalled();
  });

  it("fetches policies when admin with a token", async () => {
    renderWithClient(<RetentionPage />);
    await waitFor(() =>
      expect(getRetentionPolicies).toHaveBeenCalledWith("test-token")
    );
  });
});

describe("RetentionPage — list / empty / error", () => {
  it("renders the policy list with display name", async () => {
    renderWithClient(<RetentionPage />);
    expect(await screen.findByText("Member Data")).toBeInTheDocument();
  });

  it("renders the read-only dataCategory in display mode", async () => {
    renderWithClient(<RetentionPage />);
    await screen.findByText("Member Data");
    expect(screen.getByText("member_data")).toBeInTheDocument();
  });

  it("renders the action badge with the real action colour class (Anonymize -> yellow)", async () => {
    getRetentionPolicies.mockResolvedValue([
      makePolicy({ action: "Anonymize" }),
    ]);
    renderWithClient(<RetentionPage />);
    const badge = await screen.findByText("actions.anonymize");
    expect(badge.className).toContain("bg-yellow-100");
  });

  it("renders the empty state when there are no policies", async () => {
    getRetentionPolicies.mockResolvedValue([]);
    renderWithClient(<RetentionPage />);
    expect(await screen.findByText("noPolicies")).toBeInTheDocument();
  });

  it("surfaces a load error", async () => {
    getRetentionPolicies.mockRejectedValue(new Error("load-fail"));
    renderWithClient(<RetentionPage />);
    expect(await screen.findByText("load-fail")).toBeInTheDocument();
  });
});

describe("RetentionPage — edit + save", () => {
  it("opens the edit form with the policy values and dataCategory NOT editable", async () => {
    renderWithClient(<RetentionPage />);
    fireEvent.click(await screen.findByText("edit"));
    // Editable fields each have a label + control inside a wrapping div.
    expect(controlForLabel("fields.displayName").tagName).toBe("INPUT");
    expect(controlForLabel("fields.retentionMonths").getAttribute("type")).toBe(
      "number"
    );
    expect(controlForLabel("fields.action").tagName).toBe("SELECT");
    expect(controlForLabel("fields.legalBasis").tagName).toBe("INPUT");
    // dataCategory is read-only: it has NO label/control in edit mode at all
    // (it only appears as display text — `fields.category` — in display mode).
    expect(screen.queryByText("fields.category")).not.toBeInTheDocument();
  });

  it("the action select offers Anonymize/Archive/Delete options", async () => {
    renderWithClient(<RetentionPage />);
    fireEvent.click(await screen.findByText("edit"));
    const select = controlForLabel("fields.action");
    expect(select.querySelectorAll("option").length).toBe(3);
    expect(screen.getByText("actions.archive")).toBeInTheDocument();
    expect(screen.getByText("actions.delete")).toBeInTheDocument();
  });

  it("saving calls updateRetentionPolicy with the edited form and shows success", async () => {
    updateRetentionPolicy.mockResolvedValue(makePolicy());
    renderWithClient(<RetentionPage />);
    fireEvent.click(await screen.findByText("edit"));

    fireEvent.change(controlForLabel("fields.displayName"), {
      target: { value: "Updated Name" },
    });
    fireEvent.change(controlForLabel("fields.retentionMonths"), {
      target: { value: "36" },
    });
    fireEvent.change(controlForLabel("fields.action"), {
      target: { value: "Delete" },
    });

    fireEvent.click(screen.getByText("save"));

    await waitFor(() =>
      expect(updateRetentionPolicy).toHaveBeenCalledWith(
        "test-token",
        "p1",
        expect.objectContaining({
          displayName: "Updated Name",
          retentionMonths: 36,
          action: "Delete",
          isActive: true,
        })
      )
    );
    expect(await screen.findByText("updateSuccess")).toBeInTheDocument();
  });

  it("surfaces an update error", async () => {
    updateRetentionPolicy.mockRejectedValue(new Error("update-fail"));
    renderWithClient(<RetentionPage />);
    fireEvent.click(await screen.findByText("edit"));
    fireEvent.click(screen.getByText("save"));
    expect(await screen.findByText("update-fail")).toBeInTheDocument();
  });

  it("cancel exits edit mode back to display mode", async () => {
    renderWithClient(<RetentionPage />);
    fireEvent.click(await screen.findByText("edit"));
    expect(controlForLabel("fields.displayName").tagName).toBe("INPUT");
    fireEvent.click(screen.getByText("cancel"));
    // Back in display mode: the editable displayName label is gone, the card shows the name.
    expect(screen.queryByText("fields.displayName")).not.toBeInTheDocument();
    expect(screen.getByText("Member Data")).toBeInTheDocument();
  });
});

describe("RetentionPage — enforce (no confirm, orange)", () => {
  it("the enforce button is ORANGE and triggers enforcement WITHOUT a confirm step", async () => {
    enforceRetention.mockResolvedValue({ processedRecords: 7 });
    renderWithClient(<RetentionPage />);
    await waitFor(() => expect(getRetentionPolicies).toHaveBeenCalled());
    const enforceBtn = screen
      .getByText("enforceNow")
      .closest("button") as HTMLButtonElement;
    expect(enforceBtn.className).toContain("bg-orange-600");

    fireEvent.click(enforceBtn);
    // No confirm dialog — enforceRetention is called directly.
    await waitFor(() =>
      expect(enforceRetention).toHaveBeenCalledWith("test-token")
    );
    expect(await screen.findByText("enforceSuccess")).toBeInTheDocument();
  });

  it("surfaces an enforce error", async () => {
    enforceRetention.mockRejectedValue(new Error("enforce-fail"));
    renderWithClient(<RetentionPage />);
    await waitFor(() => expect(getRetentionPolicies).toHaveBeenCalled());
    fireEvent.click(screen.getByText("enforceNow"));
    expect(await screen.findByText("enforce-fail")).toBeInTheDocument();
  });
});

describe("RetentionPage — success toast auto-dismiss (5s fake timers)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("dismisses the success message after 5 seconds of virtual time", async () => {
    getRetentionPolicies.mockResolvedValue([makePolicy()]);
    enforceRetention.mockResolvedValue({ processedRecords: 3 });
    renderWithClient(<RetentionPage />);

    await vi.waitFor(() => expect(getRetentionPolicies).toHaveBeenCalled());
    fireEvent.click(screen.getByText("enforceNow"));

    await vi.waitFor(() =>
      expect(screen.getByText("enforceSuccess")).toBeInTheDocument()
    );

    // Advance past the 5s auto-dismiss timer (the effect schedules it after the
    // success message commits, so advance a touch beyond 5000ms to be safe).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5100);
    });
    expect(screen.queryByText("enforceSuccess")).not.toBeInTheDocument();
  });
});
