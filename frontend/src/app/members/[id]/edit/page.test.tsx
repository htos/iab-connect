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
import type { DuplicateCandidateDto } from "@/features/members/api/member-duplicates";

/**
 * E23-S2: behaviour-preserving regression spec for the EDIT Member page
 * (REQ-013 / REQ-018) AFTER the feature-slice migration.
 *
 * Transport delta vs E23-S1 (A79): the GET load now goes through `useMember`
 * (`useApiClient` → `{data,error,status}`); the PUT submit stays on raw `fetch`
 * (the S2-DEC-1 exception — the 409 ProblemDetails body carries
 * `existingMemberId`). The REQ-018 duplicate-detection contract is unchanged:
 *   - a 350ms-DEBOUNCED `AbortController` re-check with `excludeMemberId`,
 *   - Exact hard-blocks, Likely gated behind `confirmedProceed`,
 *   - 409+existingMemberId synthesizes an Exact candidate,
 *   - success → `router.push("/members")`, NO `membershipType` select.
 */

vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

const push = vi.fn();
const router = { push, replace: vi.fn(), refresh: vi.fn() };
const MEMBER_ID = "11111111-1111-1111-1111-111111111111";
const params = { id: MEMBER_ID };
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

// Stable auth + stable apiClient (A64/A78). The GET load uses apiClient.get; the
// PUT submit uses raw fetch (stubbed below).
const apiGet = vi.fn();
const apiClient = {
  get: apiGet,
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  upload: vi.fn(),
};
const authState = {
  isAuthenticated: true,
  isLoading: false,
  isVorstand: true,
  isAdmin: false,
  accessToken: "test-token",
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => apiClient,
}));

const { findMemberDuplicates } = vi.hoisted(() => ({
  findMemberDuplicates: vi.fn(),
}));
vi.mock("@/features/members/api/member-duplicates", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/members/api/member-duplicates")>()),
  findMemberDuplicates,
}));

import EditMemberPage from "./page";

const MEMBER = {
  id: MEMBER_ID,
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  phone: "",
  street: "Main St 1",
  city: "Zurich",
  postalCode: "8000",
  country: "Schweiz",
  membershipType: "Regular",
  membershipTypeDisplay: "Regular",
  status: "Active",
  statusDisplay: "Active",
  memberSince: "2026-01-01",
};

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

// Only the PUT submit hits raw fetch now (GET goes through apiClient).
function putOk() {
  return Promise.resolve({ ok: true, status: 200, json: async () => MEMBER });
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.isVorstand = true;
  authState.isAdmin = false;
  authState.accessToken = "test-token";

  findMemberDuplicates.mockResolvedValue([]);
  apiGet.mockResolvedValue({ data: MEMBER, error: null, status: 200 });

  fetchMock = vi.fn(() => putOk());
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
      <EditMemberPage />
    </QueryClientProvider>
  );
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "common.save" }));
}

function putCalls() {
  return fetchMock.mock.calls.filter(
    (c) => (c[1] as { method?: string })?.method === "PUT"
  );
}

describe("EditMemberPage — behaviour preserved (E23-S2 slice)", () => {
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
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("loads the member via apiClient GET and prefills the form; renders NO membershipType select", async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByLabelText(/form\.firstName/)).toHaveValue("Ada")
    );
    expect(screen.getByLabelText(/form\.email/)).toHaveValue("ada@example.com");
    expect(apiGet).toHaveBeenCalledWith(`/api/v1/members/${MEMBER_ID}`);
    // Unlike NEW, EDIT has no membership-type select.
    expect(
      screen.queryByLabelText(/form\.membershipType/)
    ).not.toBeInTheDocument();
  });

  it("renders the not-found error view when the GET returns 404", async () => {
    apiGet.mockResolvedValue({ data: null, error: null, status: 404 });

    renderPage();

    expect(
      await screen.findByText("members.memberNotFound")
    ).toBeInTheDocument();
  });

  it("runs a 350ms-debounced duplicate re-check with excludeMemberId after a name change", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByLabelText(/form\.firstName/)).toHaveValue("Ada")
    );

    // Ignore the mount-time re-check fired from the prefilled values.
    findMemberDuplicates.mockClear();

    fireEvent.change(screen.getByLabelText(/form\.lastName/), {
      target: { value: "Byron", name: "lastName" },
    });

    // Debounced: not called synchronously on the change.
    expect(findMemberDuplicates).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(findMemberDuplicates).toHaveBeenCalledWith(
        "test-token",
        expect.objectContaining({
          lastName: "Byron",
          excludeMemberId: MEMBER_ID,
        }),
        expect.any(AbortSignal)
      )
    );
  });

  it("HARD-BLOCKS submit on an Exact match: no PUT fires and the warning is shown", async () => {
    findMemberDuplicates.mockResolvedValue([
      makeCandidate({ matchTier: "Exact", matchReason: "Email" }),
    ]);

    renderPage();
    await waitFor(() =>
      expect(screen.getByLabelText(/form\.firstName/)).toHaveValue("Ada")
    );

    // The debounced re-check fires from the loaded form data → Exact warning.
    await waitFor(() =>
      expect(screen.getByTestId("duplicate-warning")).toBeInTheDocument()
    );
    expect(
      screen.getByText("members.duplicateWarning.blocked")
    ).toBeInTheDocument();

    submit();

    await waitFor(() => expect(findMemberDuplicates).toHaveBeenCalled());
    expect(putCalls()).toHaveLength(0);
    expect(push).not.toHaveBeenCalledWith("/members");
  });

  it("gates a Likely-only match behind a save-anyway confirm: first submit no PUT; after confirming, the PUT fires", async () => {
    findMemberDuplicates.mockResolvedValue([
      makeCandidate({ matchTier: "Likely", matchReason: "NameOnly" }),
    ]);

    renderPage();
    await waitFor(() =>
      expect(screen.getByLabelText(/form\.firstName/)).toHaveValue("Ada")
    );

    await waitFor(() =>
      expect(
        screen.getByTestId("duplicate-warning-confirm")
      ).toBeInTheDocument()
    );

    // First submit: gated, no PUT.
    submit();
    await waitFor(() => expect(findMemberDuplicates).toHaveBeenCalled());
    expect(putCalls()).toHaveLength(0);

    // Confirm "save anyway", then submit → PUT fires.
    fireEvent.click(screen.getByTestId("duplicate-warning-confirm"));
    submit();

    await waitFor(() => expect(putCalls().length).toBeGreaterThan(0));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/members"));
  });

  it("submits via PUT and redirects to /members on the happy path (no duplicates)", async () => {
    findMemberDuplicates.mockResolvedValue([]);

    renderPage();
    await waitFor(() =>
      expect(screen.getByLabelText(/form\.firstName/)).toHaveValue("Ada")
    );

    submit();

    await waitFor(() =>
      expect(
        putCalls().some((c) =>
          String(c[0]).includes(`/api/v1/members/${MEMBER_ID}`)
        )
      ).toBe(true)
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/members"));
  });

  it("synthesizes an Exact candidate from a 409 + existingMemberId PUT response", async () => {
    findMemberDuplicates.mockResolvedValue([]);
    fetchMock.mockImplementation((_url: string, init?: { method?: string }) => {
      if (init?.method === "PUT") {
        return Promise.resolve({
          ok: false,
          status: 409,
          json: async () => ({
            existingMemberId: "existing-99",
            error: "conflict-message",
          }),
        });
      }
      return putOk();
    });

    renderPage();
    await waitFor(() =>
      expect(screen.getByLabelText(/form\.firstName/)).toHaveValue("Ada")
    );

    submit();

    await waitFor(() =>
      expect(screen.getByTestId("duplicate-warning")).toBeInTheDocument()
    );
    expect(
      screen.getByText("members.duplicateWarning.blocked")
    ).toBeInTheDocument();
    expect(await screen.findByText("conflict-message")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalledWith("/members");
  });

  it("shows an error banner and stays on the page when a non-409 PUT fails", async () => {
    fetchMock.mockImplementation((_url: string, init?: { method?: string }) => {
      if (init?.method === "PUT") {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({ message: "Update broke" }),
        });
      }
      return putOk();
    });

    renderPage();
    await waitFor(() =>
      expect(screen.getByLabelText(/form\.firstName/)).toHaveValue("Ada")
    );

    submit();

    expect(await screen.findByText("Update broke")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalledWith("/members");
  });
});
