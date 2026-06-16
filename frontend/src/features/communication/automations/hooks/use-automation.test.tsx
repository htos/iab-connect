// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * E25-S2: behaviour invariants of the automations detail query + lifecycle
 * mutation hooks. DEC-1 = A wraps `@/features/communication/automations/api/automations` (token-param fns that
 * THROW on non-ok). The detail query uses `retry: false` (DEC-A93 — the god-page
 * rendered its error panel on the first failed fetch, and the wrapped lib fn
 * carries no status to distinguish a 404). The lifecycle mutation writes the
 * returned DTO into the `detail(id)` cache + invalidates the list (A79).
 */

const libSpy = vi.hoisted(() => ({
  getAutomation: vi.fn(),
  changeAutomationStatus: vi.fn(),
}));
vi.mock("@/features/communication/automations/api/automations", () => ({
  getAutomation: (...a: unknown[]) => libSpy.getAutomation(...a),
  changeAutomationStatus: (...a: unknown[]) =>
    libSpy.changeAutomationStatus(...a),
  // unused-but-imported-by-the-api-module fns:
  listAutomations: vi.fn(),
  getExecutions: vi.fn(),
  createAutomation: vi.fn(),
  updateAutomation: vi.fn(),
  previewRecipients: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ accessToken: "test-token" }),
}));

import { useAutomation } from "./use-automation";
import { useAutomationLifecycle } from "./use-automation-lifecycle";
import { automationsKeys } from "../api/automations-api";

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
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
  libSpy.getAutomation.mockReset();
  libSpy.changeAutomationStatus.mockReset();
});

afterEach(cleanup);

describe("useAutomation", () => {
  it("returns the detail data on success", async () => {
    libSpy.getAutomation.mockResolvedValue({ id: "abc", name: "Welcome" });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAutomation("abc", true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: "abc", name: "Welcome" });
    expect(libSpy.getAutomation).toHaveBeenCalledWith("test-token", "abc");
  });

  it("surfaces the error without retrying (single fetch, god-page parity)", async () => {
    libSpy.getAutomation.mockRejectedValue(new Error("loadError"));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAutomation("abc", true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    // retry: false → exactly one transport call.
    expect(libSpy.getAutomation).toHaveBeenCalledTimes(1);
  });

  it("does not fetch when disabled (auth gate)", () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useAutomation("abc", false), { wrapper });
    expect(libSpy.getAutomation).not.toHaveBeenCalled();
  });
});

describe("useAutomationLifecycle", () => {
  it("writes the returned DTO into the detail cache + invalidates the list", async () => {
    const updated = { id: "abc", status: "Active" };
    libSpy.changeAutomationStatus.mockResolvedValue(updated);
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const setSpy = vi.spyOn(queryClient, "setQueryData");

    const { result } = renderHook(() => useAutomationLifecycle("abc"), {
      wrapper,
    });
    result.current.mutate("activate");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(libSpy.changeAutomationStatus).toHaveBeenCalledWith(
      "test-token",
      "abc",
      "activate"
    );
    expect(setSpy).toHaveBeenCalledWith(automationsKeys.detail("abc"), updated);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: automationsKeys.all,
    });
  });

  it("throws on a non-ok response so the detail banner can surface it", async () => {
    libSpy.changeAutomationStatus.mockRejectedValue(new Error("Conflict"));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAutomationLifecycle("abc"), {
      wrapper,
    });
    result.current.mutate("disable");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("Conflict");
  });
});
