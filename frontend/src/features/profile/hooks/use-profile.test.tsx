// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * E29-S4: behaviour invariants of the profile slice hooks (the A76/A79
 * bug-magnet surface).
 *
 *  - `useProfile`: a 404 throws `NoMemberRecordError` (the no-record view); a
 *    non-404 error throws the `error.loadingError` i18n key (the inline notice);
 *    a 200 returns the member. DEC-1=A → `useApiClient` (mocked `{data,error,
 *    status}`).
 *  - `useToggleConsent`: SUCCESS resolves (BRANCH 2) + invalidates the consents
 *    key; an explicit ERROR rejects (BRANCH 3) so the component shows the
 *    no-timer error message.
 *  - `useRevokeSession`: OPTIMISTIC removal via `setQueryData` on `onMutate`
 *    (the row disappears before the network settles) and ROLLBACK on error (the
 *    row re-appears).
 */

const apiSpy = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
  upload: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  useApiClient: () => apiSpy,
  useAuth: () => ({ accessToken: "test-token", isAuthenticated: true }),
}));

const privacySpy = vi.hoisted(() => ({
  getConsents: vi.fn(() => Promise.resolve([])),
  grantConsent: vi.fn(() => Promise.resolve()),
  revokeConsent: vi.fn(() => Promise.resolve()),
  getChannelPreference: vi.fn(() => Promise.resolve({})),
  updateChannelPreference: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/lib/api/privacy", () => privacySpy);

const usersSpy = vi.hoisted(() => ({
  getMySessions: vi.fn(() => Promise.resolve({ sessions: [] })),
  revokeMySession: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/lib/api/users", () => usersSpy);

import { useProfile, NoMemberRecordError } from "./use-profile";
import { useToggleConsent } from "./use-toggle-consent";
import { useRevokeSession } from "./use-revoke-session";
import { profileKeys } from "../api/profile-api";

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      // `retryDelay: 0`: the E29 review (P4) gives `useProfile` a per-query
      // `retry` PREDICATE (404 → no retry; other errors → the provider's
      // `retry: 1`). A function `retry` overrides this client's `retry: false`,
      // so a non-404 error now retries once — `retryDelay: 0` lets that single
      // retry settle instantly so the error-OUTCOME assertions stay fast.
      queries: { retry: false, retryDelay: 0 },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("useProfile (DEC-1=A → useApiClient)", () => {
  it("returns the member on a 200", async () => {
    const member = { id: "m1", firstName: "Anna" };
    apiSpy.get.mockResolvedValue({ data: member, error: null, status: 200 });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useProfile(true), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(member);
    expect(apiSpy.get).toHaveBeenCalledWith("/api/v1/members/me");
  });

  it("throws NoMemberRecordError on a 404 (the no-member-record view)", async () => {
    apiSpy.get.mockResolvedValue({ data: null, error: null, status: 404 });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useProfile(true), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(NoMemberRecordError);
  });

  it("throws the error.loadingError key on a non-404 failure", async () => {
    apiSpy.get.mockResolvedValue({
      data: null,
      error: "boom",
      status: 500,
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useProfile(true), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("error.loadingError");
  });

  it("does not fetch when disabled (auth gate)", () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useProfile(false), { wrapper });
    expect(apiSpy.get).not.toHaveBeenCalled();
  });
});

describe("useToggleConsent (A76 BRANCH 2 vs 3)", () => {
  it("SUCCESS: resolves and invalidates the consents key", async () => {
    privacySpy.grantConsent.mockResolvedValue(undefined);
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useToggleConsent(), { wrapper });

    result.current.mutate({
      consentType: "EventNotifications",
      currentlyGranted: false,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(privacySpy.grantConsent).toHaveBeenCalledWith(
      "test-token",
      "EventNotifications"
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: profileKeys.consents(),
    });
  });

  it("ERROR: rejects (drives the no-timer error message branch)", async () => {
    privacySpy.grantConsent.mockRejectedValue(new Error("grant failed"));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useToggleConsent(), { wrapper });

    result.current.mutate({
      consentType: "EventNotifications",
      currentlyGranted: false,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("grant failed");
  });
});

describe("useRevokeSession (A79 optimistic removal + rollback)", () => {
  const SESSIONS = [
    {
      id: "session-a",
      ipAddress: null,
      start: null,
      lastAccess: null,
      clients: [],
    },
    {
      id: "session-b",
      ipAddress: null,
      start: null,
      lastAccess: null,
      clients: [],
    },
  ];

  it("OPTIMISTIC: removes the row from the sessions cache on mutate", async () => {
    usersSpy.revokeMySession.mockResolvedValue(undefined);
    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(profileKeys.sessions(), SESSIONS);
    const { result } = renderHook(() => useRevokeSession(), { wrapper });

    result.current.mutate("session-a");

    // optimistic removal happens in onMutate (before the network settles)
    await waitFor(() => {
      const cache = queryClient.getQueryData(profileKeys.sessions()) as {
        id: string;
      }[];
      expect(cache.map((s) => s.id)).toEqual(["session-b"]);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("ROLLBACK: restores the removed row when the revoke rejects", async () => {
    usersSpy.revokeMySession.mockRejectedValue(new Error("nope"));
    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(profileKeys.sessions(), SESSIONS);
    const { result } = renderHook(() => useRevokeSession(), { wrapper });

    result.current.mutate("session-a");

    await waitFor(() => expect(result.current.isError).toBe(true));
    const cache = queryClient.getQueryData(profileKeys.sessions()) as {
      id: string;
    }[];
    // the optimistic removal was rolled back — both rows present again
    expect(cache.map((s) => s.id)).toEqual(["session-a", "session-b"]);
  });
});
