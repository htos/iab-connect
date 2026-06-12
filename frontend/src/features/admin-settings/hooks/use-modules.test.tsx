// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * E27-S3: behaviour invariants of the modules query + update mutation. DEC-1 = A
 * builds the transport on `useApiClient`. The mutation invalidates the modules query
 * AND calls `refreshAppSettings()` (the branding + module saves were the two god-page
 * call sites of the global refresh); a failed PUT throws so the content keeps the
 * confirm modal open. The query does not fire when disabled (auth gate).
 */

const apiSpy = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  upload: vi.fn(),
}));
const refreshAppSettings = vi.fn();
vi.mock("@/lib/auth", () => ({
  useApiClient: () => apiSpy,
  useAuth: () => ({ accessToken: "tok" }),
}));
vi.mock("@/components/providers/AppSettingsProvider", () => ({
  useAppSettings: () => ({ refresh: refreshAppSettings }),
}));

import { useModules, useUpdateModule } from "./use-modules";
import { adminSettingsKeys } from "../api/admin-settings-api";

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
  apiSpy.get.mockReset();
  apiSpy.put.mockReset();
  refreshAppSettings.mockReset();
});

afterEach(cleanup);

describe("useModules", () => {
  it("returns the module rows on success", async () => {
    apiSpy.get.mockResolvedValue({
      data: [{ moduleKey: "finance", enabled: true }],
      error: null,
      status: 200,
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useModules(true), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      { moduleKey: "finance", enabled: true },
    ]);
  });

  it("does not fetch when disabled (auth gate)", () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useModules(false), { wrapper });
    expect(apiSpy.get).not.toHaveBeenCalled();
  });
});

describe("useUpdateModule", () => {
  it("invalidates the modules query and refreshes app settings on success", async () => {
    apiSpy.put.mockResolvedValue({ data: null, error: null, status: 200 });
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateModule(), { wrapper });
    result.current.mutate({ moduleKey: "finance", enabled: false });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiSpy.put).toHaveBeenCalledWith("/api/v1/module-settings/finance", {
      enabled: false,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: adminSettingsKeys.modules,
    });
    expect(refreshAppSettings).toHaveBeenCalled();
  });

  it("throws on a failed PUT (so the confirm modal stays open) and does NOT refresh", async () => {
    apiSpy.put.mockResolvedValue({ data: null, error: "boom", status: 500 });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateModule(), { wrapper });
    result.current.mutate({ moduleKey: "finance", enabled: false });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("boom");
    expect(refreshAppSettings).not.toHaveBeenCalled();
  });
});
