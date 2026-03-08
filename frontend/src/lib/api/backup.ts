/**
 * Backup API client
 * REQ-053: Backup & Restore Konzept
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export interface BackupDto {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  type: string;
  status: string;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  restoredAt: string | null;
  restoredBy: string | null;
}

/**
 * Get list of all backups
 */
export async function getBackups(accessToken: string): Promise<BackupDto[]> {
  const response = await fetch(`${API_BASE}/api/v1/admin/backups`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to fetch backups");
  }

  return response.json();
}

/**
 * Create a new backup
 */
export async function createBackup(
  accessToken: string,
  notes?: string
): Promise<BackupDto> {
  const response = await fetch(`${API_BASE}/api/v1/admin/backups`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ notes: notes || null }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to create backup");
  }

  return response.json();
}

/**
 * Get a specific backup by ID
 */
export async function getBackupById(
  accessToken: string,
  id: string
): Promise<BackupDto> {
  const response = await fetch(`${API_BASE}/api/v1/admin/backups/${encodeURIComponent(id)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to fetch backup");
  }

  return response.json();
}

/**
 * Download a backup file
 */
export async function downloadBackup(
  accessToken: string,
  id: string,
  fileName: string
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/api/v1/admin/backups/${encodeURIComponent(id)}/download`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to download backup");
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Delete a backup
 */
export async function deleteBackup(
  accessToken: string,
  id: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/v1/admin/backups/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to delete backup");
  }
}

/**
 * Restore a database from a backup
 */
export async function restoreBackup(
  accessToken: string,
  id: string
): Promise<BackupDto> {
  const response = await fetch(
    `${API_BASE}/api/v1/admin/backups/${encodeURIComponent(id)}/restore`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to restore backup");
  }

  return response.json();
}

/**
 * Upload a backup file
 */
export async function uploadBackup(
  accessToken: string,
  file: File,
  notes?: string
): Promise<BackupDto> {
  const formData = new FormData();
  formData.append("file", file);
  if (notes) {
    formData.append("notes", notes);
  }

  const response = await fetch(`${API_BASE}/api/v1/admin/backups/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to upload backup");
  }

  return response.json();
}

export interface BackupScheduleDto {
  enabled: boolean;
  cronExpression: string | null;
}

/**
 * Get current backup schedule
 */
export async function getBackupSchedule(
  accessToken: string
): Promise<BackupScheduleDto> {
  const response = await fetch(`${API_BASE}/api/v1/admin/backups/schedule`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to fetch backup schedule");
  }

  return response.json();
}

/**
 * Set backup schedule
 */
export async function setBackupSchedule(
  accessToken: string,
  cronExpression: string
): Promise<BackupScheduleDto> {
  const response = await fetch(`${API_BASE}/api/v1/admin/backups/schedule`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cronExpression }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to set backup schedule");
  }

  return response.json();
}

/**
 * Disable backup schedule
 */
export async function disableBackupSchedule(
  accessToken: string
): Promise<BackupScheduleDto> {
  const response = await fetch(`${API_BASE}/api/v1/admin/backups/schedule`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to disable backup schedule");
  }

  return response.json();
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Get status color classes for backup status badges
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case "Completed":
      return "bg-green-100 text-green-800";
    case "InProgress":
      return "bg-yellow-100 text-yellow-800";
    case "Failed":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

/**
 * Get type color classes for backup type badges
 */
export function getTypeColor(type: string): string {
  switch (type) {
    case "Manual":
      return "bg-blue-100 text-blue-800";
    case "Scheduled":
      return "bg-purple-100 text-purple-800";
    case "Upload":
      return "bg-orange-100 text-orange-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}
