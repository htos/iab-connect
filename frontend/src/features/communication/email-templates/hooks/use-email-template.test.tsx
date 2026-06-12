// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * E25-S4: behaviour invariants of the email-templates detail query + the
 * create/update/delete mutations. DEC-1 = A WRAPs `@/lib/email-templates` (token-
 * param fns that THROW an `ApiError { statusCode }` on non-ok). Because the wrapped
 * lib fn carries a status (A93), the detail query CAN distinguish a 404: it throws
 * `EmailTemplateNotFoundError` on `statusCode === 404` (excluded from retry so the
 * not-found view renders on the first fetch — god-page parity) and rethrows any
 * other error (one retry). The mutations invalidate the list root (delete/create)
 * + detail (update) on success (A79). `EmailTemplate.id` is numeric throughout.
 */

const libSpy = vi.hoisted(() => ({
  getAllTemplates: vi.fn(),
  getTemplateById: vi.fn(),
  createTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
}));
vi.mock("@/lib/email-templates", () => ({
  emailTemplatesApi: {
    getAllTemplates: (...a: unknown[]) => libSpy.getAllTemplates(...a),
    getTemplateById: (...a: unknown[]) => libSpy.getTemplateById(...a),
    createTemplate: (...a: unknown[]) => libSpy.createTemplate(...a),
    updateTemplate: (...a: unknown[]) => libSpy.updateTemplate(...a),
    deleteTemplate: (...a: unknown[]) => libSpy.deleteTemplate(...a),
  },
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ accessToken: "test-token" }),
}));

import { useEmailTemplate } from "./use-email-template";
import { useCreateEmailTemplate } from "./use-create-email-template";
import { useUpdateEmailTemplate } from "./use-update-email-template";
import { useDeleteEmailTemplate } from "./use-delete-email-template";
import { emailTemplatesKeys } from "../api/email-templates-api";

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
  libSpy.getAllTemplates.mockReset();
  libSpy.getTemplateById.mockReset();
  libSpy.createTemplate.mockReset();
  libSpy.updateTemplate.mockReset();
  libSpy.deleteTemplate.mockReset();
});

afterEach(cleanup);

describe("useEmailTemplate", () => {
  it("returns the detail data on success (forwards numeric id + token)", async () => {
    libSpy.getTemplateById.mockResolvedValue({ id: 5, name: "Welcome" });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useEmailTemplate(5, true), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: 5, name: "Welcome" });
    expect(libSpy.getTemplateById).toHaveBeenCalledWith(5, "test-token");
  });

  it("throws the not-found sentinel on a 404 ApiError (and does NOT retry)", async () => {
    libSpy.getTemplateById.mockRejectedValue({
      message: "nf",
      statusCode: 404,
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useEmailTemplate(5, true), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).name).toBe(
      "EmailTemplateNotFoundError"
    );
    // sentinel is excluded from retry → exactly one fetch.
    expect(libSpy.getTemplateById).toHaveBeenCalledTimes(1);
  });

  it("rethrows a non-404 error (not the sentinel)", async () => {
    libSpy.getTemplateById.mockRejectedValue({
      message: "boom",
      statusCode: 500,
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useEmailTemplate(5, true), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).name).not.toBe(
      "EmailTemplateNotFoundError"
    );
  });

  it("does not fetch when disabled (auth gate)", () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useEmailTemplate(5, false), { wrapper });
    expect(libSpy.getTemplateById).not.toHaveBeenCalled();
  });
});

describe("useCreateEmailTemplate", () => {
  it("invalidates the list on success", async () => {
    libSpy.createTemplate.mockResolvedValue({ id: 9 });
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateEmailTemplate(), { wrapper });
    result.current.mutate({ name: "x" } as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: emailTemplatesKeys.all,
    });
  });
});

describe("useUpdateEmailTemplate", () => {
  it("invalidates the list + the edited detail on success (numeric id)", async () => {
    libSpy.updateTemplate.mockResolvedValue({ id: 5 });
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateEmailTemplate(), { wrapper });
    result.current.mutate({ id: 5, body: { name: "x" } as never });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: emailTemplatesKeys.all,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: emailTemplatesKeys.detail(5),
    });
  });
});

describe("useDeleteEmailTemplate", () => {
  it("DELETEs by numeric id + invalidates the list on success", async () => {
    libSpy.deleteTemplate.mockResolvedValue(undefined);
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteEmailTemplate(), { wrapper });
    result.current.mutate(7);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(libSpy.deleteTemplate).toHaveBeenCalledWith(7, "test-token");
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: emailTemplatesKeys.all,
    });
  });

  it("rejects (does not invalidate) when the delete fails", async () => {
    libSpy.deleteTemplate.mockRejectedValue(new Error("nope"));
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteEmailTemplate(), { wrapper });
    result.current.mutate(7);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("nope");
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
