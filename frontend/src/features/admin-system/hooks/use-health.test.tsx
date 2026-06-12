// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * E27-S4: behaviour invariants of `useHealth`. DEC-3 = A: the god-page's
 * `setInterval(fetchHealth, 30000)` becomes a TanStack `refetchInterval: 30_000`.
 * This pins the 30s cadence with fake timers (mirrors the S1 health net's poll
 * test) and the admin/token gate (`enabled`).
 */

const libSpy = vi.hoisted(() => ({ getHealthDetail: vi.fn() }));
vi.mock("@/lib/api/health", () => ({
  getHealthDetail: (...a: unknown[]) => libSpy.getHealthDetail(...a),
}));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ accessToken: "test-token" }),
}));

import { useHealth } from "./use-health";

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { wrapper };
}

beforeEach(() => {
  libSpy.getHealthDetail.mockReset();
  libSpy.getHealthDetail.mockResolvedValue({
    status: "Healthy",
    totalDuration: 1,
    entries: [],
  });
});

afterEach(cleanup);

describe("useHealth", () => {
  it("does not fetch when disabled (admin/token gate)", () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useHealth(false), { wrapper });
    expect(libSpy.getHealthDetail).not.toHaveBeenCalled();
  });

  it("fetches the detail with the token when enabled", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useHealth(true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(libSpy.getHealthDetail).toHaveBeenCalledWith("test-token");
  });
});

describe("useHealth — 30s refetchInterval (DEC-3 = A)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("re-fetches every 30s via refetchInterval", async () => {
    libSpy.getHealthDetail.mockResolvedValue({
      status: "Healthy",
      totalDuration: 1,
      entries: [],
    });
    const { wrapper } = makeWrapper();
    renderHook(() => useHealth(true), { wrapper });

    await vi.waitFor(() =>
      expect(libSpy.getHealthDetail).toHaveBeenCalledTimes(1)
    );
    await vi.advanceTimersByTimeAsync(30000);
    expect(libSpy.getHealthDetail).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(30000);
    expect(libSpy.getHealthDetail).toHaveBeenCalledTimes(3);
  });
});
