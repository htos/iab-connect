// Backups feature API (E27-S4). DEC-1 = A: WRAPS the existing `backup`
// transport (token-param fns owning their `/api/v1/admin/backups*` URLs + the
// token-bearing blob download). Byte-identical delegation keeps the E27-S1 backups
// spec's `vi.mock("backup")` intercepting with ZERO transport-mock edits
// (A94). The slice owns the query-key factory + invalidation convention.
import {
  getBackups,
  createBackup,
  deleteBackup,
  downloadBackup,
  restoreBackup,
  uploadBackup,
  getBackupSchedule,
  setBackupSchedule,
  disableBackupSchedule,
} from "./backup";
import type { BackupDto, BackupScheduleDto } from "../types/backups.types";

/**
 * Query-key convention. The backups list has no server-side filters (loaded
 * whole), so `list()` is a flat key; the schedule is a sibling resource keyed
 * under the same `all` root so a backup mutation that should refresh both can
 * invalidate `backupsKeys.all`. Mutations invalidate `backupsKeys.list()` (the
 * god-page re-ran `fetchBackups()` after every create/delete/restore/upload/retry).
 */
export const backupsKeys = {
  all: ["backups"] as const,
  list: () => ["backups", "list"] as const,
  schedule: () => ["backups", "schedule"] as const,
};

/** List all backups. */
export function fetchBackups(token: string): Promise<BackupDto[]> {
  return getBackups(token);
}

/** Create a new (manual) backup, optional notes. Also the retry mechanism. */
export function postBackup(token: string, notes?: string): Promise<BackupDto> {
  return createBackup(token, notes);
}

/** Delete a backup by id. */
export function removeBackup(token: string, id: string): Promise<void> {
  return deleteBackup(token, id);
}

/** Restore the database from a backup (highest-risk action). */
export function postRestoreBackup(
  token: string,
  id: string
): Promise<BackupDto> {
  return restoreBackup(token, id);
}

/**
 * Token-bearing blob download (Completed rows only). The lib fn builds the blob →
 * anchor → click internally; we keep that mechanism (DEC-1) so the URL never leaks
 * into a component.
 */
export function getBackupDownload(
  token: string,
  id: string,
  fileName: string
): Promise<void> {
  return downloadBackup(token, id, fileName);
}

/** Upload a backup file (FormData) with optional notes. */
export function postUploadBackup(
  token: string,
  file: File,
  notes?: string
): Promise<BackupDto> {
  return uploadBackup(token, file, notes);
}

/** Read the current backup schedule. */
export function fetchBackupSchedule(token: string): Promise<BackupScheduleDto> {
  return getBackupSchedule(token);
}

/** Set (PUT) the backup schedule cron expression. */
export function putBackupSchedule(
  token: string,
  cronExpression: string
): Promise<BackupScheduleDto> {
  return setBackupSchedule(token, cronExpression);
}

/** Disable (DELETE) the backup schedule. */
export function deleteBackupSchedule(
  token: string
): Promise<BackupScheduleDto> {
  return disableBackupSchedule(token);
}
