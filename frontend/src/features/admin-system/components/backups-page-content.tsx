"use client";

/**
 * Backup Management page content (E27-S4). Feature-slice composition root; the
 * route file is a thin entry rendering this — the single `"use client"` boundary.
 *
 * Behaviour preserved verbatim (pinned by the E27-S1 backups net): the admin auth
 * guard (non-admin → `router.push("/")` + `return null`; fetch gated on
 * `isAuthenticated && isAdmin && accessToken`), the stats summary, the schedule
 * section (preset/custom-cron + save + disable, disable shown only when enabled),
 * the list table with status/type badges, create (modal + notes), restore (inline
 * 2-button confirm — DEC-4 = A flips it to RED here, A86; failure keeps confirm),
 * delete (inline 2-button confirm RED; failure keeps confirm), download (Completed
 * only), retry (Failed → re-create with old notes), upload (modal FormData), and
 * the 5s success-toast auto-dismiss. Server-state moves to the slice hooks; every
 * list-changing mutation invalidates the list (A79). The schedule
 * `fetchSchedule()`-not-in-deps staleness is folded into `useBackupSchedule` (AC-8).
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PageShell } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { formatFileSize } from "../api/backup";
import { useBackups } from "../hooks/use-backups";
import {
  useCreateBackup,
  useDeleteBackup,
  useDownloadBackup,
  useRestoreBackup,
  useUploadBackup,
} from "../hooks/use-backup-mutations";
import {
  useBackupSchedule,
  useDisableBackupSchedule,
  useSetBackupSchedule,
} from "../hooks/use-backup-schedule";
import { BackupsTable } from "./backups-table";
import { CreateBackupDialog } from "./create-backup-dialog";
import { UploadBackupDialog } from "./upload-backup-dialog";
import type { BackupDto } from "../types/backups.types";

const CRON_PRESETS: Record<string, string> = {
  daily: "0 2 * * *",
  weekly: "0 2 * * 1",
  monthly: "0 2 1 * *",
};

function cronToPreset(cron: string): string {
  for (const [key, val] of Object.entries(CRON_PRESETS)) {
    if (val === cron) return key;
  }
  return "custom";
}

export function BackupsPageContent() {
  const t = useTranslations("admin.backups");
  const router = useRouter();
  const {
    isAuthenticated,
    isLoading: authLoading,
    isAdmin,
    accessToken,
  } = useAuth();

  const gated = Boolean(isAuthenticated && isAdmin && accessToken);

  const {
    data: backupsData,
    isLoading,
    error: loadError,
    refetch: refetchBackups,
  } = useBackups(gated);
  const { data: schedule } = useBackupSchedule(gated);
  const createBackup = useCreateBackup();
  const deleteBackup = useDeleteBackup();
  const restoreBackup = useRestoreBackup();
  const uploadBackup = useUploadBackup();
  const downloadBackup = useDownloadBackup();
  const setSchedule = useSetBackupSchedule();
  const disableSchedule = useDisableBackupSchedule();

  const backups = backupsData ?? [];

  // UI state. Action error (create/delete/restore/upload/schedule) only; the LOAD
  // error is DERIVED from the query below (no server-state mirror via effect).
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [restoreConfirmId, setRestoreConfirmId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createNotes, setCreateNotes] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Schedule form state. The form is a user-editable view of the loaded schedule.
  // Rather than mirror the async-loaded cron into state via an effect (cascading-
  // render smell), the EFFECTIVE preset/cron is DERIVED: the loaded schedule's
  // value until the user overrides it (`*Override` is `null` until the user edits
  // the field), preserving the god-page's "select pre-populates from the saved
  // schedule, then follows user input" behaviour.
  const loadedPreset = schedule?.cronExpression
    ? cronToPreset(schedule.cronExpression)
    : "daily";
  const loadedCustomCron =
    schedule?.cronExpression && loadedPreset === "custom"
      ? schedule.cronExpression
      : "";
  const [presetOverride, setPresetOverride] = useState<string | null>(null);
  const [customCronOverride, setCustomCronOverride] = useState<string | null>(
    null
  );
  const schedulePreset = presetOverride ?? loadedPreset;
  const customCron = customCronOverride ?? loadedCustomCron;
  const setSchedulePreset = (value: string) => setPresetOverride(value);
  const setCustomCron = (value: string) => setCustomCronOverride(value);

  const error =
    actionError ??
    (loadError
      ? loadError instanceof Error
        ? loadError.message
        : t("errors.loadFailed")
      : null);

  // Redirect if not admin.
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  // Auto-dismiss success messages after 5s.
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const cronToLabel = (cron: string | null | undefined): string => {
    if (!cron) return "";
    const preset = cronToPreset(cron);
    if (preset !== "custom") return t(`schedule.${preset}`);
    return cron;
  };

  const handleCreateBackup = async () => {
    setActionError(null);
    try {
      await createBackup.mutateAsync(createNotes || undefined);
      setSuccessMessage(t("createSuccess"));
      setShowCreateModal(false);
      setCreateNotes("");
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : t("errors.createFailed")
      );
    }
  };

  const handleDownload = async (backup: BackupDto) => {
    setActionError(null);
    try {
      await downloadBackup.mutateAsync({
        id: backup.id,
        fileName: backup.fileName,
      });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : t("errors.downloadFailed")
      );
    }
  };

  const handleDelete = async (id: string) => {
    setActionError(null);
    try {
      await deleteBackup.mutateAsync(id);
      setSuccessMessage(t("deleteSuccess"));
      setDeleteConfirmId(null);
    } catch (err) {
      // Failure keeps the confirm state (id only cleared on success).
      setActionError(
        err instanceof Error ? err.message : t("errors.deleteFailed")
      );
    }
  };

  const handleRetry = async (notes?: string) => {
    setActionError(null);
    try {
      await createBackup.mutateAsync(notes || undefined);
      setSuccessMessage(t("retrySuccess"));
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : t("errors.createFailed")
      );
    }
  };

  const handleRestore = async (id: string) => {
    setActionError(null);
    try {
      await restoreBackup.mutateAsync(id);
      setSuccessMessage(t("restoreSuccess"));
      setRestoreConfirmId(null);
    } catch (err) {
      // Failure keeps the confirm state (id only cleared on success).
      setActionError(
        err instanceof Error ? err.message : t("errors.restoreFailed")
      );
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setActionError(null);
    try {
      await uploadBackup.mutateAsync({
        file: uploadFile,
        notes: uploadNotes || undefined,
      });
      setSuccessMessage(t("uploadSuccess"));
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadNotes("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : t("errors.uploadFailed")
      );
    }
  };

  const handleSaveSchedule = async () => {
    setActionError(null);
    const cronExpression =
      schedulePreset === "custom" ? customCron : CRON_PRESETS[schedulePreset];
    if (!cronExpression) return;
    try {
      await setSchedule.mutateAsync(cronExpression);
      setSuccessMessage(t("schedule.saveSuccess"));
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : t("schedule.saveFailed")
      );
    }
  };

  const handleDisableSchedule = async () => {
    setActionError(null);
    try {
      await disableSchedule.mutateAsync();
      setSuccessMessage(t("schedule.disableSuccess"));
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : t("schedule.disableFailed")
      );
    }
  };

  const isSavingSchedule = setSchedule.isPending || disableSchedule.isPending;

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  const completedCount = backups.filter((b) => b.status === "Completed").length;
  const totalSize = backups
    .filter((b) => b.status === "Completed")
    .reduce((sum, b) => sum + b.fileSizeBytes, 0);

  return (
    <PageShell>
      <Link
        href="/admin"
        className="mb-6 inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        {t("backToAdmin")}
      </Link>

      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-1 text-gray-600">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetchBackups()}
            className="flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-2 hover:bg-gray-200 focus:ring-2 focus:ring-orange-500 focus:outline-none"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {t("refresh")}
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-2 hover:bg-gray-200 focus:ring-2 focus:ring-orange-500 focus:outline-none"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            {t("uploadBackup")}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-white hover:bg-orange-700 focus:ring-2 focus:ring-orange-500 focus:outline-none"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            {t("createBackup")}
          </button>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4">
          <svg
            className="h-5 w-5 shrink-0 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-green-800">{successMessage}</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4">
          <svg
            className="h-5 w-5 shrink-0 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-red-800">{error}</span>
          <button
            onClick={() => setActionError(null)}
            className="ml-auto text-red-600 hover:text-red-800"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Stats Summary */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-600">{t("stats.total")}</p>
          <p className="text-2xl font-bold text-gray-900">{backups.length}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-600">{t("stats.completed")}</p>
          <p className="text-2xl font-bold text-green-600">{completedCount}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-600">{t("stats.totalSize")}</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatFileSize(totalSize)}
          </p>
        </div>
      </div>

      {/* Schedule Section */}
      <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          {t("schedule.title")}
        </h2>
        <p className="mb-4 text-sm text-gray-600">
          {t("schedule.description")}
        </p>

        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("schedule.interval")}
            </label>
            <select
              value={schedulePreset}
              onChange={(e) => setSchedulePreset(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
            >
              <option value="daily">{t("schedule.daily")}</option>
              <option value="weekly">{t("schedule.weekly")}</option>
              <option value="monthly">{t("schedule.monthly")}</option>
              <option value="custom">{t("schedule.custom")}</option>
            </select>
          </div>

          {schedulePreset === "custom" && (
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("schedule.cronExpression")}
              </label>
              <input
                type="text"
                value={customCron}
                onChange={(e) => setCustomCron(e.target.value)}
                placeholder="0 2 * * *"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
              />
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSaveSchedule}
              disabled={
                isSavingSchedule || (schedulePreset === "custom" && !customCron)
              }
              className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {isSavingSchedule ? (
                <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
              ) : (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
              {t("schedule.save")}
            </button>
            {schedule?.enabled && (
              <button
                onClick={handleDisableSchedule}
                disabled={isSavingSchedule}
                className="rounded-xl bg-red-100 px-4 py-2 text-sm text-red-700 hover:bg-red-200 disabled:opacity-50"
              >
                {t("schedule.disable")}
              </button>
            )}
          </div>
        </div>

        {schedule?.enabled && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3">
            <svg
              className="h-5 w-5 shrink-0 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-sm text-green-800">
              {t("schedule.active", {
                cron: cronToLabel(schedule.cronExpression),
              })}
            </span>
          </div>
        )}
      </div>

      {/* Backup Table */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
          </div>
        ) : backups.length === 0 ? (
          <div className="p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {t("noBackups")}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {t("noBackupsDescription")}
            </p>
          </div>
        ) : (
          <BackupsTable
            backups={backups}
            restoreConfirmId={restoreConfirmId}
            deleteConfirmId={deleteConfirmId}
            isRestoring={restoreBackup.isPending}
            onDownload={handleDownload}
            onRestoreConfirm={setRestoreConfirmId}
            onRestore={handleRestore}
            onRestoreCancel={() => setRestoreConfirmId(null)}
            onRetry={handleRetry}
            onDeleteConfirm={setDeleteConfirmId}
            onDelete={handleDelete}
            onDeleteCancel={() => setDeleteConfirmId(null)}
          />
        )}
      </div>

      {/* Create Backup Modal */}
      {showCreateModal && (
        <CreateBackupDialog
          notes={createNotes}
          isCreating={createBackup.isPending}
          onNotesChange={setCreateNotes}
          onConfirm={handleCreateBackup}
          onCancel={() => {
            setShowCreateModal(false);
            setCreateNotes("");
          }}
        />
      )}

      {/* Upload Backup Modal */}
      {showUploadModal && (
        <UploadBackupDialog
          fileInputRef={fileInputRef}
          notes={uploadNotes}
          hasFile={!!uploadFile}
          isUploading={uploadBackup.isPending}
          onFileChange={setUploadFile}
          onNotesChange={setUploadNotes}
          onConfirm={handleUpload}
          onCancel={() => {
            setShowUploadModal(false);
            setUploadFile(null);
            setUploadNotes("");
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
        />
      )}
    </PageShell>
  );
}
