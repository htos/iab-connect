// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * E25-S3: behaviour invariants of the email-campaigns detail query + action
 * mutations. DEC-1 = A BUILDs the transport on `useApiClient` ({ data, error,
 * status }, never throws). UNLIKE the automations sibling, `useApiClient` carries
 * a status, so the detail query CAN distinguish a 404: it throws
 * `EmailCampaignNotFoundError` on `status === 404` (excluded from retry so the
 * not-found view renders on the first fetch — god-page parity) and a generic Error
 * otherwise (one retry). The action mutations invalidate detail + statistics +
 * recipients + all (A79).
 */

const apiSpy = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  upload: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  useApiClient: () => apiSpy,
  useAuth: () => ({ accessToken: "tok" }),
}));

import { useEmailCampaign } from "./use-email-campaign";
import { useCampaignActions } from "./use-campaign-actions";
import { emailCampaignsKeys } from "../api/email-campaigns-api";

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
  apiSpy.post.mockReset();
  apiSpy.put.mockReset();
  apiSpy.delete.mockReset();
});

afterEach(cleanup);

describe("useEmailCampaign", () => {
  it("returns the detail data on success", async () => {
    apiSpy.get.mockResolvedValue({
      data: { id: "c1", name: "Spring" },
      error: null,
      status: 200,
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useEmailCampaign("c1", true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: "c1", name: "Spring" });
  });

  it("throws the not-found sentinel on a 404 (and does NOT retry)", async () => {
    apiSpy.get.mockResolvedValue({ data: null, error: "nf", status: 404 });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useEmailCampaign("c1", true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).name).toBe(
      "EmailCampaignNotFoundError"
    );
    // sentinel is excluded from retry → exactly one fetch.
    expect(apiSpy.get).toHaveBeenCalledTimes(1);
  });

  it("does not fetch when disabled (auth gate)", () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useEmailCampaign("c1", false), { wrapper });
    expect(apiSpy.get).not.toHaveBeenCalled();
  });
});

describe("useCampaignActions", () => {
  it("send invalidates detail + statistics + recipients + all on success", async () => {
    apiSpy.post.mockResolvedValue({ data: null, error: null, status: 200 });
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCampaignActions("c1"), { wrapper });
    result.current.send.mutate(undefined);

    await waitFor(() => expect(result.current.send.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: emailCampaignsKeys.detail("c1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: emailCampaignsKeys.statistics("c1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: emailCampaignsKeys.recipients("c1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: emailCampaignsKeys.all,
    });
  });

  it("an action throws on a non-ok result so the detail banner can branch", async () => {
    apiSpy.post.mockResolvedValue({
      data: null,
      error: "Conflict",
      status: 409,
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCampaignActions("c1"), { wrapper });
    result.current.cancel.mutate(undefined);

    await waitFor(() => expect(result.current.cancel.isError).toBe(true));
    expect((result.current.cancel.error as Error).message).toBe("Conflict");
  });

  it("test does NOT invalidate (god-page /test did not refetch)", async () => {
    apiSpy.post.mockResolvedValue({ data: null, error: null, status: 200 });
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCampaignActions("c1"), { wrapper });
    result.current.test.mutate("t@e.org");

    await waitFor(() => expect(result.current.test.isSuccess).toBe(true));
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
