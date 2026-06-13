// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * E27-S4: behaviour invariants of the backup CRUD mutation hooks (A79). Each
 * list-changing mutation must invalidate `backupsKeys.list()` on success
 * (replacing the god-page's manual `fetchBackups()` re-run). DEC-1 = A wraps the
 * `backup` transport.
 */

const libSpy = vi.hoisted(() => ({
  restoreBackup: vi.fn(),
  deleteBackup: vi.fn(),
  createBackup: vi.fn(),
  uploadBackup: vi.fn(),
  downloadBackup: vi.fn(),
}));
vi.mock("@/features/admin-system/api/backup", () => ({
  restoreBackup: (...a: unknown[]) => libSpy.restoreBackup(...a),
  deleteBackup: (...a: unknown[]) => libSpy.deleteBackup(...a),
  createBackup: (...a: unknown[]) => libSpy.createBackup(...a),
  uploadBackup: (...a: unknown[]) => libSpy.uploadBackup(...a),
  downloadBackup: (...a: unknown[]) => libSpy.downloadBackup(...a),
}));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ accessToken: "test-token" }),
}));

import {
  useCreateBackup,
  useDeleteBackup,
  useDownloadBackup,
  useRestoreBackup,
} from "./use-backup-mutations";
import { backupsKeys } from "../api/backups-api";

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

beforeEach(() => {
  Object.values(libSpy).forEach((fn) => fn.mockReset());
});

afterEach(cleanup);

describe("useRestoreBackup", () => {
  it("invalidates the backups list on success", async () => {
    libSpy.restoreBackup.mockResolvedValue({ id: "b1" });
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useRestoreBackup(), { wrapper });
    result.current.mutate("b1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(libSpy.restoreBackup).toHaveBeenCalledWith("test-token", "b1");
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: backupsKeys.list(),
    });
  });

  it("surfaces the error and does NOT invalidate on failure (failure-keeps-confirm)", async () => {
    libSpy.restoreBackup.mockRejectedValue(new Error("restore-fail"));
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useRestoreBackup(), { wrapper });
    result.current.mutate("b1");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("restore-fail");
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});

describe("useDeleteBackup", () => {
  it("invalidates the backups list on success", async () => {
    libSpy.deleteBackup.mockResolvedValue(undefined);
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteBackup(), { wrapper });
    result.current.mutate("b1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(libSpy.deleteBackup).toHaveBeenCalledWith("test-token", "b1");
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: backupsKeys.list(),
    });
  });
});

describe("useCreateBackup", () => {
  it("invalidates the backups list on success (also the retry mechanism)", async () => {
    libSpy.createBackup.mockResolvedValue({ id: "b2" });
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateBackup(), { wrapper });
    result.current.mutate("nightly");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(libSpy.createBackup).toHaveBeenCalledWith("test-token", "nightly");
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: backupsKeys.list(),
    });
  });
});

describe("useDownloadBackup", () => {
  it("forwards id + fileName and does NOT invalidate (download changes nothing)", async () => {
    libSpy.downloadBackup.mockResolvedValue(undefined);
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDownloadBackup(), { wrapper });
    result.current.mutate({ id: "b1", fileName: "backup.sql" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(libSpy.downloadBackup).toHaveBeenCalledWith(
      "test-token",
      "b1",
      "backup.sql"
    );
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
