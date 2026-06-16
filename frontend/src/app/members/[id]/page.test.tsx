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
 * E23-S2: Behaviour tests for the Members DETAIL page (REQ-016) AFTER the
 * feature-slice refactor.
 *
 * The page is now a thin server entry rendering the `MemberDetail` client
 * composition root, which consumes `useApiClient` (TanStack query + mutations)
 * instead of raw `fetch` + `accessToken`. The transport is repointed from
 * `vi.stubGlobal("fetch")` to a mocked `apiClient` (mirroring
 * `src/app/sponsors/[id]/page.test.tsx`), but the behavioural coverage carried
 * over from the E23-S1 characterization is PRESERVED: auth redirects (+ no GET),
 * 404 not-found, full-page error, loading spinner, status/type PUT with
 * state-from-response (no refetch), admin-only delete, delete -> redirect,
 * failed delete -> error surfaced + no redirect, failed status change -> alert,
 * and the A76 destructive affordance.
 *
 * The delete affordance moved from `confirm()`/`alert()` to the accessible
 * `DeleteMemberDialog` (the licensed A79 change), so the delete tests now open
 * the dialog and click its confirm button. Mutation errors still surface via
 * `alert` (stubbed); the status/type error mechanism is unchanged.
 */

vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

const push = vi.fn();
const router = { push, replace: vi.fn(), refresh: vi.fn() };
const params = { id: "11111111-1111-1111-1111-111111111111" };
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

const apiGet = vi.fn();
const apiPut = vi.fn();
const apiPost = vi.fn();
const apiDelete = vi.fn();
const apiClient = {
  get: apiGet,
  put: apiPut,
  post: apiPost,
  delete: apiDelete,
  upload: vi.fn(),
};
const authState = {
  isAuthenticated: true,
  isLoading: false,
  isVorstand: false,
  isAdmin: true,
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => apiClient,
}));

import MemberDetailPage from "./page";

const MEMBER_ID = "11111111-1111-1111-1111-111111111111";

function makeMember(overrides: Record<string, unknown> = {}) {
  return {
    id: MEMBER_ID,
    firstName: "Mia",
    lastName: "Member",
    email: "mia@example.com",
    phone: "+41 11 111 11 11",
    street: "Hauptstrasse 1",
    city: "Zürich",
    postalCode: "8000",
    country: "CH",
    membershipType: "Regular",
    membershipTypeDisplay: "Regular",
    status: "Active",
    statusDisplay: "Active",
    memberSince: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("alert", vi.fn());
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.isVorstand = false;
  authState.isAdmin = true;
  apiGet.mockResolvedValue({ data: makeMember(), error: null, status: 200 });
  apiPut.mockResolvedValue({ data: makeMember(), error: null, status: 200 });
  apiPost.mockResolvedValue({ data: makeMember(), error: null, status: 200 });
  apiDelete.mockResolvedValue({ data: null, error: null, status: 200 });
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
      <MemberDetailPage />
    </QueryClientProvider>
  );
}

describe("MemberDetailPage — feature-slice behaviour", () => {
  it("redirects unauthenticated users to /login and fires no GET", async () => {
    authState.isAuthenticated = false;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("redirects authenticated users who are neither Vorstand nor Admin to / and fires no GET", async () => {
    authState.isAuthenticated = true;
    authState.isVorstand = false;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("loads the member by id and renders contact + profile info", async () => {
    renderPage();

    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith(`/api/v1/members/${MEMBER_ID}`)
    );
    // name renders in both the header and the profile card
    expect(await screen.findAllByText("Mia Member")).not.toHaveLength(0);
    expect(
      screen.getByRole("link", { name: "mia@example.com" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "+41 11 111 11 11" })
    ).toBeInTheDocument();
  });

  it("renders the not-found view when the GET returns 404", async () => {
    apiGet.mockResolvedValue({ data: null, error: null, status: 404 });

    renderPage();

    expect(
      await screen.findByText("members.memberNotFound")
    ).toBeInTheDocument();
  });

  it("renders the full-page error view when the GET returns a non-404 error", async () => {
    apiGet.mockResolvedValue({ data: null, error: "Boom", status: 500 });

    renderPage();

    // full-page error surface: the error heading + the thrown message
    expect(await screen.findByText("Boom")).toBeInTheDocument();
    expect(screen.getByText("common.error")).toBeInTheDocument();
  });

  it("shows a loading spinner while the GET is pending", async () => {
    apiGet.mockReturnValue(new Promise(() => {}));

    const { container } = renderPage();

    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("changes status via PUT .../status and replaces state from the response WITHOUT a refetch", async () => {
    apiPut.mockResolvedValue({
      data: makeMember({ status: "Suspended" }),
      error: null,
      status: 200,
    });

    renderPage();
    await screen.findAllByText("Mia Member");

    const statusSelect = screen.getByDisplayValue("status.active");
    fireEvent.change(statusSelect, { target: { value: "Suspended" } });

    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith(
        `/api/v1/members/${MEMBER_ID}/status`,
        { status: "Suspended" }
      )
    );

    // exactly ONE GET total (initial load); the PUT response replaced state.
    expect(apiGet).toHaveBeenCalledTimes(1);
    // state reflects the PUT response
    expect(await screen.findByDisplayValue("status.suspended")).toBeTruthy();
  });

  it("changes type via PUT .../type and replaces state from the response WITHOUT a refetch", async () => {
    apiPut.mockResolvedValue({
      data: makeMember({ membershipType: "Student" }),
      error: null,
      status: 200,
    });

    renderPage();
    await screen.findAllByText("Mia Member");

    const typeSelect = screen.getByDisplayValue("membershipType.regular");
    fireEvent.change(typeSelect, { target: { value: "Student" } });

    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith(`/api/v1/members/${MEMBER_ID}/type`, {
        membershipType: "Student",
      })
    );

    expect(apiGet).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByDisplayValue("membershipType.student")
    ).toBeTruthy();
  });

  it("deletes the member via the dialog and redirects to /members", async () => {
    renderPage();
    await screen.findAllByText("Mia Member");

    // header delete button (admin-only) opens the confirm dialog
    fireEvent.click(screen.getByRole("button", { name: "common.delete" }));

    // confirm in the dialog (the last common.delete button)
    const deleteButtons = await screen.findAllByRole("button", {
      name: "common.delete",
    });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);

    await waitFor(() =>
      expect(apiDelete).toHaveBeenCalledWith(`/api/v1/members/${MEMBER_ID}`)
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/members"));
  });

  it("does NOT issue the DELETE when the dialog is cancelled", async () => {
    renderPage();
    await screen.findAllByText("Mia Member");

    fireEvent.click(screen.getByRole("button", { name: "common.delete" }));

    // cancel the dialog instead of confirming
    fireEvent.click(
      await screen.findByRole("button", { name: "common.cancel" })
    );

    expect(apiDelete).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalledWith("/members");
  });

  it("does NOT render the delete affordance for a Vorstand-but-not-Admin user", async () => {
    authState.isVorstand = true;
    authState.isAdmin = false;

    renderPage();
    await screen.findAllByText("Mia Member");

    expect(
      screen.queryByRole("button", { name: "common.delete" })
    ).not.toBeInTheDocument();
  });

  it("A76: the delete affordance is visibly destructive", async () => {
    renderPage();
    await screen.findAllByText("Mia Member");

    const deleteButton = screen.getByRole("button", { name: "common.delete" });
    expect(deleteButton.className).toMatch(/red|destructive/);
  });

  it("A76: a failed delete surfaces an error (alert) and does not redirect", async () => {
    const alertSpy = vi.fn();
    vi.stubGlobal("alert", alertSpy);
    apiDelete.mockResolvedValue({
      data: null,
      error: "Delete failed",
      status: 500,
    });

    renderPage();
    await screen.findAllByText("Mia Member");

    fireEvent.click(screen.getByRole("button", { name: "common.delete" }));
    const deleteButtons = await screen.findAllByRole("button", {
      name: "common.delete",
    });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith("error.deletingError")
    );
    expect(push).not.toHaveBeenCalledWith("/members");
  });

  it("A76: a failed status quick-change surfaces an error (alert)", async () => {
    const alertSpy = vi.fn();
    vi.stubGlobal("alert", alertSpy);
    apiPut.mockResolvedValue({ data: null, error: "Boom", status: 500 });

    renderPage();
    await screen.findAllByText("Mia Member");

    fireEvent.change(screen.getByDisplayValue("status.active"), {
      target: { value: "Suspended" },
    });

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith("error.updatingError")
    );
  });
});
