// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * E27-S4: the backups slice api owns the query-key factory and WRAPS the
 * `@/lib/api/backup` transport (DEC-1 = A). Asserts the key shapes + byte-identical
 * delegation (A94), including the token-bearing blob download mechanism kept inside
 * the lib fn (the wrapper just forwards id + fileName).
 */

const libSpy = vi.hoisted(() => ({
  getBackups: vi.fn(),
  createBackup: vi.fn(),
  deleteBackup: vi.fn(),
  downloadBackup: vi.fn(),
  restoreBackup: vi.fn(),
  uploadBackup: vi.fn(),
  getBackupSchedule: vi.fn(),
  setBackupSchedule: vi.fn(),
  disableBackupSchedule: vi.fn(),
}));
vi.mock("@/lib/api/backup", () => ({
  getBackups: (...a: unknown[]) => libSpy.getBackups(...a),
  createBackup: (...a: unknown[]) => libSpy.createBackup(...a),
  deleteBackup: (...a: unknown[]) => libSpy.deleteBackup(...a),
  downloadBackup: (...a: unknown[]) => libSpy.downloadBackup(...a),
  restoreBackup: (...a: unknown[]) => libSpy.restoreBackup(...a),
  uploadBackup: (...a: unknown[]) => libSpy.uploadBackup(...a),
  getBackupSchedule: (...a: unknown[]) => libSpy.getBackupSchedule(...a),
  setBackupSchedule: (...a: unknown[]) => libSpy.setBackupSchedule(...a),
  disableBackupSchedule: (...a: unknown[]) =>
    libSpy.disableBackupSchedule(...a),
}));

import {
  backupsKeys,
  deleteBackupSchedule,
  fetchBackupSchedule,
  fetchBackups,
  getBackupDownload,
  postBackup,
  postRestoreBackup,
  postUploadBackup,
  putBackupSchedule,
  removeBackup,
} from "./backups-api";

afterEach(() => vi.clearAllMocks());

describe("backupsKeys", () => {
  it("exposes the stable key shapes", () => {
    expect(backupsKeys.all).toEqual(["backups"]);
    expect(backupsKeys.list()).toEqual(["backups", "list"]);
    expect(backupsKeys.schedule()).toEqual(["backups", "schedule"]);
  });
});

describe("backups api wrappers (byte-identical delegation, A94)", () => {
  it("fetchBackups forwards the token", () => {
    fetchBackups("tok");
    expect(libSpy.getBackups).toHaveBeenCalledWith("tok");
  });

  it("postBackup forwards token + notes (also the retry mechanism)", () => {
    postBackup("tok", "nightly");
    expect(libSpy.createBackup).toHaveBeenCalledWith("tok", "nightly");
  });

  it("removeBackup forwards token + id", () => {
    removeBackup("tok", "b1");
    expect(libSpy.deleteBackup).toHaveBeenCalledWith("tok", "b1");
  });

  it("postRestoreBackup forwards token + id", () => {
    postRestoreBackup("tok", "b1");
    expect(libSpy.restoreBackup).toHaveBeenCalledWith("tok", "b1");
  });

  it("getBackupDownload forwards token + id + fileName (token blob kept in lib fn)", () => {
    getBackupDownload("tok", "b1", "backup.sql");
    expect(libSpy.downloadBackup).toHaveBeenCalledWith(
      "tok",
      "b1",
      "backup.sql"
    );
  });

  it("postUploadBackup forwards token + file + notes", () => {
    const file = new File(["x"], "x.sql");
    postUploadBackup("tok", file, "from disk");
    expect(libSpy.uploadBackup).toHaveBeenCalledWith("tok", file, "from disk");
  });

  it("schedule wrappers forward to the lib fns", () => {
    fetchBackupSchedule("tok");
    putBackupSchedule("tok", "0 2 * * *");
    deleteBackupSchedule("tok");
    expect(libSpy.getBackupSchedule).toHaveBeenCalledWith("tok");
    expect(libSpy.setBackupSchedule).toHaveBeenCalledWith("tok", "0 2 * * *");
    expect(libSpy.disableBackupSchedule).toHaveBeenCalledWith("tok");
  });
});
