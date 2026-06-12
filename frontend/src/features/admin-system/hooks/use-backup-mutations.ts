"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  backupsKeys,
  getBackupDownload,
  postBackup,
  postRestoreBackup,
  postUploadBackup,
  removeBackup,
} from "../api/backups-api";
import type { BackupDto } from "../types/backups.types";

/**
 * Backup CRUD mutations (E27-S4, A79). Each list-changing mutation invalidates
 * `backupsKeys.list()` on success, replacing the god-page's manual `fetchBackups()`
 * re-run after create/delete/restore/upload/retry. The inline-confirm
 * "failure-keeps-confirm-state" UX is preserved in the component (it clears its
 * confirm id only inside the mutation's `onSuccess` callback) — the hooks just
 * surface success/error.
 *
 * Create + retry share `useCreateBackup` (the god-page's retry was `createBackup`
 * with the failed row's notes).
 */
export function useCreateBackup() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<BackupDto, Error, string | undefined>({
    mutationFn: (notes) => postBackup(accessToken ?? "", notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: backupsKeys.list() });
    },
  });
}

export function useDeleteBackup() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => removeBackup(accessToken ?? "", id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: backupsKeys.list() });
    },
  });
}

export function useRestoreBackup() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<BackupDto, Error, string>({
    mutationFn: (id) => postRestoreBackup(accessToken ?? "", id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: backupsKeys.list() });
    },
  });
}

export interface UploadBackupArgs {
  file: File;
  notes?: string;
}

export function useUploadBackup() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<BackupDto, Error, UploadBackupArgs>({
    mutationFn: ({ file, notes }) =>
      postUploadBackup(accessToken ?? "", file, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: backupsKeys.list() });
    },
  });
}

export interface DownloadBackupArgs {
  id: string;
  fileName: string;
}

/**
 * Token-bearing blob download (Completed rows only). The lib fn owns the
 * blob→anchor→click; this mutation just surfaces an error to the page's banner on
 * reject (god-page parity). No invalidation — download does not change the list.
 */
export function useDownloadBackup() {
  const { accessToken } = useAuth();
  return useMutation<void, Error, DownloadBackupArgs>({
    mutationFn: ({ id, fileName }) =>
      getBackupDownload(accessToken ?? "", id, fileName),
  });
}
