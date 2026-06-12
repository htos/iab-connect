// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * E27-S6: the folder CRUD + permission mutation hooks wrap the shared
 * `@/lib/services/documents` service (DEC-1=A), throw on `!result.success`, and
 * invalidate `adminFoldersKeys.all` on success. Pins the throw branch + the
 * invalidation (the god-page re-loaded the list after every mutation).
 */

const serviceSpy = vi.hoisted(() => ({
  getFolders: vi.fn(() =>
    Promise.resolve({
      success: true,
      data: [] as { id: string; name: string }[],
    })
  ),
  createFolder: vi.fn(),
  updateFolder: vi.fn(),
  deleteFolder: vi.fn(),
  setFolderPermissions: vi.fn(),
}));
vi.mock("@/lib/services/documents", () => ({
  getFolders: serviceSpy.getFolders,
  createFolder: serviceSpy.createFolder,
  updateFolder: serviceSpy.updateFolder,
  deleteFolder: serviceSpy.deleteFolder,
  setFolderPermissions: serviceSpy.setFolderPermissions,
}));

import {
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,
  useSetFolderPermissions,
} from "./use-folder-mutations";
import { useFolders } from "./use-folders";
import { adminFoldersKeys } from "../api/admin-folders-api";

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
  serviceSpy.createFolder.mockReset();
  serviceSpy.updateFolder.mockReset();
  serviceSpy.deleteFolder.mockReset();
  serviceSpy.setFolderPermissions.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("useFolders (query, keyed by parentId)", () => {
  it("returns the folder list on success", async () => {
    serviceSpy.getFolders.mockResolvedValueOnce({
      success: true,
      data: [{ id: "f1", name: "Protocols" }],
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useFolders(undefined, true), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: "f1", name: "Protocols" }]);
  });

  it("does not fetch when disabled (auth gate)", () => {
    serviceSpy.getFolders.mockClear();
    const { wrapper } = makeWrapper();
    renderHook(() => useFolders(undefined, false), { wrapper });
    expect(serviceSpy.getFolders).not.toHaveBeenCalled();
  });
});

describe("useCreateFolder", () => {
  it("invalidates adminFoldersKeys.all on success", async () => {
    serviceSpy.createFolder.mockResolvedValue({ success: true, data: {} });
    const { queryClient, wrapper } = makeWrapper();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCreateFolder(), { wrapper });

    await result.current.mutateAsync({ name: "New" });
    expect(serviceSpy.createFolder).toHaveBeenCalledWith({ name: "New" });
    expect(spy).toHaveBeenCalledWith({ queryKey: adminFoldersKeys.all });
  });

  it("throws the service error when !success", async () => {
    serviceSpy.createFolder.mockResolvedValue({
      success: false,
      error: "create-fail",
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateFolder(), { wrapper });
    await expect(result.current.mutateAsync({ name: "x" })).rejects.toThrow(
      "create-fail"
    );
  });
});

describe("useUpdateFolder / useDeleteFolder / useSetFolderPermissions", () => {
  it("update forwards id+body and invalidates on success", async () => {
    serviceSpy.updateFolder.mockResolvedValue({ success: true, data: {} });
    const { queryClient, wrapper } = makeWrapper();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useUpdateFolder(), { wrapper });
    await result.current.mutateAsync({ id: "f1", data: { name: "R" } });
    expect(serviceSpy.updateFolder).toHaveBeenCalledWith("f1", { name: "R" });
    expect(spy).toHaveBeenCalledWith({ queryKey: adminFoldersKeys.all });
  });

  it("delete forwards id and throws on !success", async () => {
    serviceSpy.deleteFolder.mockResolvedValue({
      success: false,
      error: "delete-fail",
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeleteFolder(), { wrapper });
    await expect(result.current.mutateAsync("f1")).rejects.toThrow(
      "delete-fail"
    );
    expect(serviceSpy.deleteFolder).toHaveBeenCalledWith("f1");
  });

  it("setPermissions forwards id+permissions and invalidates on success", async () => {
    serviceSpy.setFolderPermissions.mockResolvedValue({
      success: true,
      data: {},
    });
    const { queryClient, wrapper } = makeWrapper();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useSetFolderPermissions(), { wrapper });
    await result.current.mutateAsync({
      id: "f1",
      data: { permissions: [{ role: "Member", permissionType: "Read" }] },
    });
    expect(serviceSpy.setFolderPermissions).toHaveBeenCalledWith("f1", {
      permissions: [{ role: "Member", permissionType: "Read" }],
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: adminFoldersKeys.all });
  });
});
