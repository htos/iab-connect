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
import type { DuplicateCandidateDto } from "@/lib/api/members";

/**
 * E23-S1: Characterization tests for the NEW Member page (REQ-013 / REQ-018).
 *
 * Pins the CURRENT observable behaviour of `frontend/src/app/members/new/page.tsx`
 * BEFORE the E23-S2 feature-slice refactor. The load-bearing surface is the
 * REQ-018 duplicate-detection flow:
 *   - a SINGLE pre-flight duplicate check INSIDE submit (fail-open: a thrown
 *     check lets the POST proceed),
 *   - an Exact match HARD-BLOCKS the POST,
 *   - a Likely-only match is gated behind a "save anyway" confirm
 *     (`confirmedProceed`): first submit shows the warning + no POST; after
 *     confirming, a second submit fires the POST,
 *   - a `409 + existingMemberId` synthesizes an Exact candidate surfaced as a
 *     duplicate warning,
 *   - success → `router.push("/members")`.
 *
 * Harness (A35/A46/A64/A78): identity translator; stable router/auth; partial
 * mock of `@/lib/api/members` so the enums/DTO types/parseMatchReason stay REAL
 * and only `findMemberDuplicates` is controlled; raw `fetch` stubbed for the
 * POST submit; render wrapped in a fresh QueryClientProvider (retry:false).
 */

vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

const push = vi.fn();
const router = { push, replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
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

const authState = {
  isAuthenticated: true,
  isLoading: false,
  isVorstand: true,
  isAdmin: false,
  accessToken: "test-token",
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
}));

// Partial mock: keep the real enums, DTO types, parseMatchReason; control only
// the duplicate-check fetch. `vi.hoisted` so the spy exists before the hoisted
// `vi.mock` factory runs.
const { findMemberDuplicates } = vi.hoisted(() => ({
  findMemberDuplicates: vi.fn(),
}));
vi.mock("@/lib/api/members", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/members")>()),
  findMemberDuplicates,
}));

import NewMemberPage from "./page";

function makeCandidate(
  overrides: Partial<DuplicateCandidateDto> = {}
): DuplicateCandidateDto {
  return {
    id: "cand-1",
    firstName: "Existing",
    lastName: "Member",
    email: "dup@example.com",
    membershipStatus: "Active",
    memberSince: "2026-01-01",
    matchTier: "Likely",
    matchReason: "NameOnly",
    ...overrides,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

function okResponse(body: unknown, status = 201) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.isVorstand = true;
  authState.isAdmin = false;
  authState.accessToken = "test-token";

  findMemberDuplicates.mockResolvedValue([]);

  fetchMock = vi.fn().mockResolvedValue(okResponse({ id: "new-1" }, 201));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true)
  );
  vi.stubGlobal("alert", vi.fn());
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
      <NewMemberPage />
    </QueryClientProvider>
  );
}

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/form\.firstName/), {
    target: { value: "Ada", name: "firstName" },
  });
  fireEvent.change(screen.getByLabelText(/form\.lastName/), {
    target: { value: "Lovelace", name: "lastName" },
  });
  fireEvent.change(screen.getByLabelText(/form\.email/), {
    target: { value: "ada@example.com", name: "email" },
  });
  fireEvent.change(screen.getByLabelText(/form\.street/), {
    target: { value: "Main St 1", name: "street" },
  });
  fireEvent.change(screen.getByLabelText(/form\.postalCode/), {
    target: { value: "8000", name: "postalCode" },
  });
  fireEvent.change(screen.getByLabelText(/form\.city/), {
    target: { value: "Zurich", name: "city" },
  });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "members.createMember" }));
}

describe("NewMemberPage — characterization (current behaviour)", () => {
  it("redirects unauthenticated users to /login", async () => {
    authState.isAuthenticated = false;
    authState.isVorstand = false;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });

  it("redirects authenticated users who are neither Vorstand nor Admin to /", async () => {
    authState.isAuthenticated = true;
    authState.isVorstand = false;
    authState.isAdmin = false;

    renderPage();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("renders the form including the membershipType select", () => {
    renderPage();

    expect(screen.getByLabelText(/form\.firstName/)).toBeInTheDocument();
    expect(screen.getByLabelText(/form\.email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/form\.membershipType/)).toBeInTheDocument();
  });

  it("runs a single pre-flight duplicate check inside submit, then POSTs and redirects when no duplicates", async () => {
    renderPage();
    fillRequiredFields();
    submit();

    await waitFor(() => expect(findMemberDuplicates).toHaveBeenCalledTimes(1));
    expect(findMemberDuplicates).toHaveBeenCalledWith(
      "test-token",
      expect.objectContaining({
        email: "ada@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
        postalCode: "8000",
      })
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/members"),
        expect.objectContaining({ method: "POST" })
      )
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/members"));
  });

  it("is FAIL-OPEN: when the pre-flight check throws, the POST still proceeds", async () => {
    findMemberDuplicates.mockRejectedValue(new Error("network down"));

    renderPage();
    fillRequiredFields();
    submit();

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/members"),
        expect.objectContaining({ method: "POST" })
      )
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/members"));
  });

  it("HARD-BLOCKS an Exact match: no POST fires and the warning is shown", async () => {
    findMemberDuplicates.mockResolvedValue([
      makeCandidate({ matchTier: "Exact", matchReason: "Email" }),
    ]);

    renderPage();
    fillRequiredFields();
    submit();

    await waitFor(() =>
      expect(screen.getByTestId("duplicate-warning")).toBeInTheDocument()
    );
    expect(
      screen.getByText("members.duplicateWarning.blocked")
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalledWith("/members");
  });

  it("gates a Likely-only match behind a save-anyway confirm: first submit shows warning + no POST; after confirming, the POST fires", async () => {
    findMemberDuplicates.mockResolvedValue([
      makeCandidate({ matchTier: "Likely", matchReason: "NameOnly" }),
    ]);

    renderPage();
    fillRequiredFields();
    submit();

    // First submit: warning surfaces, confirm control present, no POST.
    await waitFor(() =>
      expect(screen.getByTestId("duplicate-warning")).toBeInTheDocument()
    );
    expect(screen.getByTestId("duplicate-warning-confirm")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    // Confirm "save anyway", then submit again -> POST fires.
    fireEvent.click(screen.getByTestId("duplicate-warning-confirm"));
    submit();

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/members"),
        expect.objectContaining({ method: "POST" })
      )
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/members"));
  });

  it("synthesizes an Exact candidate from a 409 + existingMemberId response", async () => {
    findMemberDuplicates.mockResolvedValue([]);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        existingMemberId: "existing-99",
        error: "conflict-message",
      }),
    });

    renderPage();
    fillRequiredFields();
    submit();

    // The 409 path surfaces a synthesized Exact candidate (warning) and the
    // error banner; no redirect.
    await waitFor(() =>
      expect(screen.getByTestId("duplicate-warning")).toBeInTheDocument()
    );
    expect(
      screen.getByText("members.duplicateWarning.blocked")
    ).toBeInTheDocument();
    expect(await screen.findByText("conflict-message")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalledWith("/members");
  });

  it("shows an error banner and stays on the page when a non-409 POST fails", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: "Save broke" }),
    });

    renderPage();
    fillRequiredFields();
    submit();

    expect(await screen.findByText("Save broke")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalledWith("/members");
  });
});
