// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * E27-S2: behaviour invariants of the admin-users slice hooks against a mocked
 * `@/features/admin-users/api/users-admin` transport (the WRAP target, A94) + a mocked `useAuth`.
 * Covers the load-bearing branches: the detail hook does NOT retry (A99/DEC-3 —
 * the wrapped lib fn throws a generic Error with no status, so a retry would
 * just hammer a permanent 404); a successful create/delete invalidates the
 * admin-users root.
 */

// `vi.hoisted` so the spy object exists before the hoisted `vi.mock` factory runs.
const lib = vi.hoisted(() => ({
  getUser: vi.fn(),
  createUser: vi.fn(),
  deleteUser: vi.fn(),
}));
vi.mock("@/features/admin-users/api/users-admin", () => lib);

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ accessToken: "test-token" }),
}));

import { useUser } from "./use-user";
import { useCreateUser } from "./use-create-user";
import { useDeleteUser } from "./use-delete-user";
import { adminUsersKeys } from "../api/admin-users-api";

function makeWrapper() {
  // NB: NO defaultOptions retry override — so the hook's own `retry: false`
  // (not a provider default) is what is exercised here.
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

beforeEach(() => {
  for (const fn of Object.values(lib)) fn.mockReset();
});
afterEach(cleanup);

describe("useUser", () => {
  it("does NOT retry a 404 (retry:false) — getUser is called exactly once", async () => {
    lib.getUser.mockRejectedValue(new Error("User not found"));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUser("u1", true), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("User not found");
    // retry:false → a single attempt, no exponential-backoff hammering.
    expect(lib.getUser).toHaveBeenCalledTimes(1);
  });

  it("returns the user on success", async () => {
    lib.getUser.mockResolvedValue({ id: "u1", email: "a@b.example" });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUser("u1", true), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: "u1", email: "a@b.example" });
  });

  it("does not fetch when disabled", () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useUser("u1", false), { wrapper });
    expect(lib.getUser).not.toHaveBeenCalled();
  });
});

describe("useCreateUser", () => {
  it("invalidates the admin-users root on a successful create", async () => {
    lib.createUser.mockResolvedValue({ id: "new" });
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateUser(), { wrapper });
    result.current.mutate({ email: "x@y.example" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: adminUsersKeys.all,
    });
  });

  it("propagates the 409 duplicate-email message", async () => {
    lib.createUser.mockRejectedValue(
      new Error("A user with this email already exists")
    );
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateUser(), { wrapper });
    result.current.mutate({ email: "dupe@y.example" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe(
      "A user with this email already exists"
    );
  });
});

describe("useDeleteUser", () => {
  it("invalidates the admin-users root on a successful delete", async () => {
    lib.deleteUser.mockResolvedValue(undefined);
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteUser(), { wrapper });
    result.current.mutate("u1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: adminUsersKeys.all,
    });
  });
});
