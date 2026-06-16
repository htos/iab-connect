// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * E24-S2: behaviour invariants of the events slice hooks against a mocked
 * `useApiClient` (the DEC-1 `{ data, error, status }` contract). Covers the
 * load-bearing branches: a 404 throws `EventNotFoundError`; a non-404 error
 * throws a generic Error; a successful create invalidates the events root.
 */

// A single mutable spy object so each test can drive what useApiClient returns.
const apiSpy = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  upload: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  useApiClient: () => apiSpy,
}));

import { EventNotFoundError, useEvent } from "./use-event";
import { useCreateEvent } from "./use-create-event";
import { eventsKeys } from "../api/events-api";

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

beforeEach(() => {
  apiSpy.get.mockReset();
  apiSpy.post.mockReset();
  apiSpy.put.mockReset();
  apiSpy.delete.mockReset();
});

afterEach(cleanup);

describe("useEvent", () => {
  it("throws EventNotFoundError on status 404", async () => {
    apiSpy.get.mockResolvedValue({
      data: null,
      error: "not found",
      status: 404,
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useEvent("e1", true), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(EventNotFoundError);
  });

  it("throws a generic Error on a non-404 error", async () => {
    apiSpy.get.mockResolvedValue({
      data: null,
      error: "boom",
      status: 500,
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useEvent("e1", true), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error).not.toBeInstanceOf(EventNotFoundError);
    expect((result.current.error as Error).message).toBe("boom");
  });

  it("returns the event data on success", async () => {
    apiSpy.get.mockResolvedValue({
      data: { id: "e1", title: "Gala" },
      error: null,
      status: 200,
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useEvent("e1", true), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: "e1", title: "Gala" });
  });

  it("does not fetch when disabled", () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useEvent("e1", false), { wrapper });
    expect(apiSpy.get).not.toHaveBeenCalled();
  });
});

describe("useCreateEvent", () => {
  it("invalidates the events root on a successful create", async () => {
    apiSpy.post.mockResolvedValue({
      data: { id: "new" },
      error: null,
      status: 201,
    });
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateEvent(), { wrapper });
    result.current.mutate({ title: "T" } as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: eventsKeys.all });
  });

  it("throws on API error so the form banner can show the message", async () => {
    apiSpy.post.mockResolvedValue({
      data: null,
      error: "save failed",
      status: 400,
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateEvent(), { wrapper });
    result.current.mutate({ title: "T" } as never);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("save failed");
  });
});
