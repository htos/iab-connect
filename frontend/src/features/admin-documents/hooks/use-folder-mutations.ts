"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminFoldersKeys,
  createFolder,
  updateFolder,
  deleteFolder,
  setFolderPermissions,
} from "../api/admin-folders-api";
import type {
  CreateFolderRequest,
  UpdateFolderRequest,
  SetFolderPermissionsRequest,
} from "../types/admin-documents.types";

/**
 * Folder CRUD + permission mutations (E27-S6). Each wraps the shared
 * `@/lib/services/documents` service (DEC-1=A) and throws on `!result.success`
 * so the `admin-folders-page-content` catch surfaces the service `error` into
 * the page error banner (preserving the god-page's `setError(result.error)`).
 * On success they invalidate `adminFoldersKeys.all` (the god-page re-loaded the
 * list after every mutation); the content ALSO drives an explicit list reload to
 * keep the subfolder-count probe + the exact post-mutation behaviour the E27-S1
 * net pins.
 */
export function useCreateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateFolderRequest) => {
      const result = await createFolder(data);
      if (!result.success) throw new Error(result.error ?? "Error");
      return result.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: adminFoldersKeys.all }),
  });
}

export function useUpdateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; data: UpdateFolderRequest }) => {
      const result = await updateFolder(vars.id, vars.data);
      if (!result.success) throw new Error(result.error ?? "Error");
      return result.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: adminFoldersKeys.all }),
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteFolder(id);
      if (!result.success) throw new Error(result.error ?? "Error");
      return result.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: adminFoldersKeys.all }),
  });
}

export function useSetFolderPermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string;
      data: SetFolderPermissionsRequest;
    }) => {
      const result = await setFolderPermissions(vars.id, vars.data);
      if (!result.success) throw new Error(result.error ?? "Error");
      return result.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: adminFoldersKeys.all }),
  });
}
