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
 * E23-S1: Characterization tests for the EDIT Member SEGMENT page (REQ-017).
 *
 * Pins the CURRENT observable behaviour of
 * `frontend/src/app/members/segments/[id]/edit/page.tsx` BEFORE the E23 members
 * feature-slice refactor. The page is a `useApiClient` (`{data,error,status}`)
 * consumer; renders are wrapped in a fresh `QueryClientProvider` (retry:false)
 * to match the harness used across the refactor.
 *
 * Observable contract: a `GET /api/v1/member-segments/{id}` prefills the form; a
 * happy-path submit fires `PUT /api/v1/member-segments/{id}` and redirects to
 * `/members/segments/{id}`; a submit error shows the banner; segment TYPE is
 * rendered READ-ONLY (text + `segments.typeNotEditable` hint), NOT an editable
 * select. Auth guard allows Admin OR Vorstand.
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
const apiClient = {
  get: apiGet,
  post: apiPost,
  put: apiPut,
  delete: vi.fn(),
  upload: vi.fn(),
};
const authState = {
  isAuthenticated: true,
  isLoading: false,
  isAdmin: true,
  isVorstand: false,
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => apiClient,
}));

import EditSegmentPage from "./page";

const SEGMENT_ID = "11111111-1111-1111-1111-111111111111";
const SEGMENT_URL = `/api/v1/member-segments/${SEGMENT_ID}`;

function makeSegment(overrides: Record<string, unknown> = {}) {
  return {
    id: SEGMENT_ID,
    name: "Board Members",
    description: "The board",
    segmentType: "Static",
    criteriaJson: undefined,
    color: "orange",
    isActive: true,
    memberCount: 2,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.isAdmin = true;
  authState.isVorstand = false;
  apiGet.mockResolvedValue({ data: makeSegment(), error: null, status: 200 });
  apiPut.mockResolvedValue({ data: makeSegment(), error: null, status: 200 });
  apiPost.mockResolvedValue({
    data: { totalCount: 0, preview: [] },
    error: null,
    status: 200,
  });
});

afterEach(cleanup);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <EditSegmentPage />
    </QueryClientProvider>
  );
}

describe("EditSegmentPage — characterization (current behaviour)", () => {
  it("redirects unauthenticated users to /login", async () => {
    authState.isAuthenticated = false;
    authState.isAdmin = false;
    authState.isVorstand = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });

  it("redirects authenticated non-Admin non-Vorstand users to /", async () => {
    authState.isAdmin = false;
    authState.isVorstand = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("allows a Vorstand (non-Admin) user and loads the segment", async () => {
    authState.isAdmin = false;
    authState.isVorstand = true;

    renderPage();

    await waitFor(() => expect(apiGet).toHaveBeenCalledWith(SEGMENT_URL));
    await waitFor(() =>
      expect(screen.getByLabelText(/segments\.field\.name/)).toHaveValue(
        "Board Members"
      )
    );
  });

  it("loads the segment by id and prefills the name + description fields", async () => {
    renderPage();

    await waitFor(() => expect(apiGet).toHaveBeenCalledWith(SEGMENT_URL));
    await waitFor(() =>
      expect(screen.getByLabelText(/segments\.field\.name/)).toHaveValue(
        "Board Members"
      )
    );
    expect(screen.getByLabelText(/segments\.field\.description/)).toHaveValue(
      "The board"
    );
  });

  it("shows a loading spinner while the GET is pending", async () => {
    apiGet.mockReturnValue(new Promise(() => {}));

    const { container } = renderPage();

    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders the segment TYPE as read-only text (not an editable select)", async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByLabelText(/segments\.field\.name/)).toHaveValue(
        "Board Members"
      )
    );
    expect(screen.getByText("segments.type.static")).toBeInTheDocument();
    expect(screen.getByText("segments.typeNotEditable")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("submits the update via PUT /api/v1/member-segments/{id} and redirects to the detail page", async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByLabelText(/segments\.field\.name/)).toHaveValue(
        "Board Members"
      )
    );
    fireEvent.change(screen.getByLabelText(/segments\.field\.name/), {
      target: { value: "Board Members Renamed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith(
        SEGMENT_URL,
        expect.objectContaining({ name: "Board Members Renamed" })
      )
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(`/members/segments/${SEGMENT_ID}`)
    );
  });

  it("omits criteriaJson from the PUT payload for a Static segment", async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByLabelText(/segments\.field\.name/)).toHaveValue(
        "Board Members"
      )
    );
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(apiPut).toHaveBeenCalled());
    const payload = apiPut.mock.calls[0][1] as { criteriaJson?: string };
    expect(payload.criteriaJson).toBeUndefined();
  });

  it("shows an error banner when the update fails and does not redirect", async () => {
    apiPut.mockResolvedValue({
      data: null,
      error: "Update failed",
      status: 400,
    });

    renderPage();

    await waitFor(() =>
      expect(screen.getByLabelText(/segments\.field\.name/)).toHaveValue(
        "Board Members"
      )
    );
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    expect(await screen.findByText("Update failed")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalledWith(`/members/segments/${SEGMENT_ID}`);
  });

  it("renders the Dynamic criteria section with a PUT payload that includes criteriaJson", async () => {
    apiGet.mockResolvedValue({
      data: makeSegment({
        segmentType: "Dynamic",
        criteriaJson: JSON.stringify({ status: ["Active"], type: [] }),
      }),
      error: null,
      status: 200,
    });

    renderPage();

    await waitFor(() =>
      expect(screen.getByLabelText(/segments\.field\.name/)).toHaveValue(
        "Board Members"
      )
    );
    expect(screen.getByText("segments.type.dynamic")).toBeInTheDocument();
    expect(screen.getByText("segments.section.criteria")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(apiPut).toHaveBeenCalled());
    const payload = apiPut.mock.calls[0][1] as { criteriaJson?: string };
    expect(typeof payload.criteriaJson).toBe("string");
  });
});
