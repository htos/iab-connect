"use client";

/**
 * Backup Management Page
 * REQ-053: Backup & Restore Konzept
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
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
  formatFileSize,
  getStatusColor,
  getTypeColor,
  BackupDto,
  BackupScheduleDto,
} from "@/lib/api/backup";

export default function BackupsPage() {
  const t = useTranslations("admin.backups");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, isAdmin, accessToken } = useAuth();

  // Data state
  const [backups, setBackups] = useState<BackupDto[]>([]);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createNotes, setCreateNotes] = useState("");
  const [restoreConfirmId, setRestoreConfirmId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadNotes, setUploadNotes] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Schedule state
  const [schedule, setSchedule] = useState<BackupScheduleDto | null>(null);
  const [schedulePreset, setSchedulePreset] = useState("daily");
  const [customCron, setCustomCron] = useState("");
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  // Fetch backups
  const fetchBackups = useCallback(async () => {
    if (!accessToken) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await getBackups(accessToken);
      setBackups(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, t]);

  useEffect(() => {
    if (isAuthenticated && isAdmin && accessToken) {
      fetchBackups();
      fetchSchedule();
    }
  }, [isAuthenticated, isAdmin, accessToken, fetchBackups]);

  // Redirect if not admin
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  // Auto-dismiss success messages
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Handle create backup
  const handleCreateBackup = async () => {
    if (!accessToken) return;

    setIsCreating(true);
    setError(null);

    try {
      await createBackup(accessToken, createNotes || undefined);
      setSuccessMessage(t("createSuccess"));
      setShowCreateModal(false);
      setCreateNotes("");
      await fetchBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.createFailed"));
    } finally {
      setIsCreating(false);
    }
  };

  // Handle download
  const handleDownload = async (backup: BackupDto) => {
    if (!accessToken) return;

    try {
      await downloadBackup(accessToken, backup.id, backup.fileName);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.downloadFailed"));
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!accessToken) return;

    try {
      await deleteBackup(accessToken, id);
      setSuccessMessage(t("deleteSuccess"));
      setDeleteConfirmId(null);
      await fetchBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.deleteFailed"));
    }
  };

  // Handle retry (re-create backup for failed ones)
  const handleRetry = async (notes?: string) => {
    if (!accessToken) return;

    setError(null);

    try {
      await createBackup(accessToken, notes || undefined);
      setSuccessMessage(t("retrySuccess"));
      await fetchBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.createFailed"));
    }
  };

  // Handle restore
  const handleRestore = async (id: string) => {
    if (!accessToken) return;

    setIsRestoring(true);
    setError(null);

    try {
      await restoreBackup(accessToken, id);
      setSuccessMessage(t("restoreSuccess"));
      setRestoreConfirmId(null);
      await fetchBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.restoreFailed"));
    } finally {
      setIsRestoring(false);
    }
  };

  // Handle upload
  const handleUpload = async () => {
    if (!accessToken || !uploadFile) return;

    setIsUploading(true);
    setError(null);

    try {
      await uploadBackup(accessToken, uploadFile, uploadNotes || undefined);
      setSuccessMessage(t("uploadSuccess"));
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadNotes("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.uploadFailed"));
    } finally {
      setIsUploading(false);
    }
  };

  // Fetch schedule
  const fetchSchedule = async () => {
    if (!accessToken) return;
    try {
      const data = await getBackupSchedule(accessToken);
      setSchedule(data);
      if (data.cronExpression) {
        const preset = cronToPreset(data.cronExpression);
        setSchedulePreset(preset);
        if (preset === "custom") setCustomCron(data.cronExpression);
      }
    } catch {
      // Schedule might not exist yet — not critical
    }
  };

  const cronPresets: Record<string, string> = {
    daily: "0 2 * * *",
    weekly: "0 2 * * 1",
    monthly: "0 2 1 * *",
  };

  const cronToPreset = (cron: string): string => {
    for (const [key, val] of Object.entries(cronPresets)) {
      if (val === cron) return key;
    }
    return "custom";
  };

  const cronToLabel = (cron: string | null | undefined): string => {
    if (!cron) return "";
    const preset = cronToPreset(cron);
    if (preset !== "custom") return t(`schedule.${preset}`);
    return cron;
  };

  // Handle save schedule
  const handleSaveSchedule = async () => {
    if (!accessToken) return;
    setIsSavingSchedule(true);
    setError(null);

    const cronExpression = schedulePreset === "custom" ? customCron : cronPresets[schedulePreset];
    if (!cronExpression) return;

    try {
      const data = await setBackupSchedule(accessToken, cronExpression);
      setSchedule(data);
      setSuccessMessage(t("schedule.saveSuccess"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("schedule.saveFailed"));
    } finally {
      setIsSavingSchedule(false);
    }
  };

  // Handle disable schedule
  const handleDisableSchedule = async () => {
    if (!accessToken) return;
    setIsSavingSchedule(true);
    setError(null);

    try {
      const data = await disableBackupSchedule(accessToken);
      setSchedule(data);
      setSuccessMessage(t("schedule.disableSuccess"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("schedule.disableFailed"));
    } finally {
      setIsSavingSchedule(false);
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t("backToAdmin")}
        </Link>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{t("title")}</h1>
            <p className="text-gray-600 mt-1">{t("subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fetchBackups()}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {t("refresh")}
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {t("uploadBackup")}
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t("createBackup")}
            </button>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-green-800">{successMessage}</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
            <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-800">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Stats Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-600">{t("stats.total")}</p>
            <p className="text-2xl font-bold text-gray-900">{backups.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-600">{t("stats.completed")}</p>
            <p className="text-2xl font-bold text-green-600">
              {backups.filter((b) => b.status === "Completed").length}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-600">{t("stats.totalSize")}</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatFileSize(
                backups
                  .filter((b) => b.status === "Completed")
                  .reduce((sum, b) => sum + b.fileSizeBytes, 0)
              )}
            </p>
          </div>
        </div>

        {/* Schedule Section */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t("schedule.title")}</h2>
          <p className="text-sm text-gray-600 mb-4">{t("schedule.description")}</p>

          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("schedule.interval")}</label>
              <select
                value={schedulePreset}
                onChange={(e) => setSchedulePreset(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="daily">{t("schedule.daily")}</option>
                <option value="weekly">{t("schedule.weekly")}</option>
                <option value="monthly">{t("schedule.monthly")}</option>
                <option value="custom">{t("schedule.custom")}</option>
              </select>
            </div>

            {schedulePreset === "custom" && (
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("schedule.cronExpression")}
                </label>
                <input
                  type="text"
                  value={customCron}
                  onChange={(e) => setCustomCron(e.target.value)}
                  placeholder="0 2 * * *"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono"
                />
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSaveSchedule}
                disabled={isSavingSchedule || (schedulePreset === "custom" && !customCron)}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {isSavingSchedule ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {t("schedule.save")}
              </button>
              {schedule?.enabled && (
                <button
                  onClick={handleDisableSchedule}
                  disabled={isSavingSchedule}
                  className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-sm disabled:opacity-50"
                >
                  {t("schedule.disable")}
                </button>
              )}
            </div>
          </div>

          {schedule?.enabled && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-green-800">
                {t("schedule.active", { cron: cronToLabel(schedule.cronExpression) })}
              </span>
            </div>
          )}
        </div>

        {/* Backup Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center p-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">{t("noBackups")}</h3>
              <p className="mt-1 text-sm text-gray-500">{t("noBackupsDescription")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t("table.fileName")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t("table.type")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t("table.status")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t("table.size")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t("table.createdAt")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t("table.createdBy")}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t("table.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {backups.map((backup) => (
                    <tr key={backup.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{backup.fileName}</div>
                        {backup.notes && (
                          <div className="text-xs text-gray-500 mt-1">{backup.notes}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(backup.type)}`}>
                          {t(`types.${backup.type.toLowerCase()}`)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(backup.status)}`}>
                          {t(`statuses.${backup.status.toLowerCase()}`)}
                        </span>
                        {backup.errorMessage && (
                          <div className="text-xs text-red-500 mt-1" title={backup.errorMessage}>
                            {backup.errorMessage.length > 50
                              ? `${backup.errorMessage.substring(0, 50)}...`
                              : backup.errorMessage}
                          </div>
                        )}
                        {backup.restoredAt && (
                          <div className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            {t("restoredInfo", { date: formatDate(backup.restoredAt), user: backup.restoredBy ?? "–" })}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {backup.status === "Completed" ? formatFileSize(backup.fileSizeBytes) : "–"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(backup.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {backup.createdBy}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex items-center justify-end gap-2">
                          {backup.status === "Completed" && (
                            <button
                              onClick={() => handleDownload(backup)}
                              className="text-orange-600 hover:text-orange-800 p-1"
                              title={t("actions.download")}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            </button>
                          )}
                          {backup.status === "Completed" && (
                            restoreConfirmId === backup.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleRestore(backup.id)}
                                  disabled={isRestoring}
                                  className="text-orange-600 hover:text-orange-800 text-xs font-medium px-2 py-1 bg-orange-50 rounded disabled:opacity-50"
                                >
                                  {isRestoring ? (
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-orange-600"></div>
                                  ) : (
                                    tCommon("confirm")
                                  )}
                                </button>
                                <button
                                  onClick={() => setRestoreConfirmId(null)}
                                  className="text-gray-600 hover:text-gray-800 text-xs font-medium px-2 py-1 bg-gray-50 rounded"
                                  disabled={isRestoring}
                                >
                                  {tCommon("cancel")}
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setRestoreConfirmId(backup.id)}
                                className="text-blue-600 hover:text-blue-800 p-1"
                                title={t("actions.restore")}
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              </button>
                            )
                          )}
                          {backup.status === "Failed" && (
                            <button
                              onClick={() => handleRetry(backup.notes ?? undefined)}
                              className="text-orange-600 hover:text-orange-800 p-1"
                              title={t("actions.retry")}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </button>
                          )}
                          {deleteConfirmId === backup.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(backup.id)}
                                className="text-red-600 hover:text-red-800 text-xs font-medium px-2 py-1 bg-red-50 rounded"
                              >
                                {tCommon("confirm")}
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="text-gray-600 hover:text-gray-800 text-xs font-medium px-2 py-1 bg-gray-50 rounded"
                              >
                                {tCommon("cancel")}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(backup.id)}
                              className="text-red-600 hover:text-red-800 p-1"
                              title={t("actions.delete")}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create Backup Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">{t("createModal.title")}</h2>
              <p className="text-sm text-gray-600 mb-4">{t("createModal.description")}</p>
              <div className="mb-4">
                <label htmlFor="backup-notes" className="block text-sm font-medium text-gray-700 mb-1">
                  {t("createModal.notes")}
                </label>
                <textarea
                  id="backup-notes"
                  value={createNotes}
                  onChange={(e) => setCreateNotes(e.target.value)}
                  placeholder={t("createModal.notesPlaceholder")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  rows={3}
                  maxLength={1000}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateNotes("");
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm"
                  disabled={isCreating}
                >
                  {tCommon("cancel")}
                </button>
                <button
                  onClick={handleCreateBackup}
                  disabled={isCreating}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {isCreating ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  )}
                  {t("createModal.confirm")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upload Backup Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">{t("uploadModal.title")}</h2>
              <p className="text-sm text-gray-600 mb-4">{t("uploadModal.description")}</p>
              <div className="mb-4">
                <label htmlFor="backup-file" className="block text-sm font-medium text-gray-700 mb-1">
                  {t("uploadModal.file")}
                </label>
                <input
                  ref={fileInputRef}
                  id="backup-file"
                  type="file"
                  accept=".sql,.dump,.backup"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div className="mb-4">
                <label htmlFor="upload-notes" className="block text-sm font-medium text-gray-700 mb-1">
                  {t("uploadModal.notes")}
                </label>
                <textarea
                  id="upload-notes"
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  placeholder={t("uploadModal.notesPlaceholder")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  rows={2}
                  maxLength={1000}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadFile(null);
                    setUploadNotes("");
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm"
                  disabled={isUploading}
                >
                  {tCommon("cancel")}
                </button>
                <button
                  onClick={handleUpload}
                  disabled={isUploading || !uploadFile}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {isUploading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  )}
                  {t("uploadModal.confirm")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
