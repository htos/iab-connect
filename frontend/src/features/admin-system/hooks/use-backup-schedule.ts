"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  backupsKeys,
  deleteBackupSchedule,
  fetchBackupSchedule,
  putBackupSchedule,
} from "../api/backups-api";
import type { BackupScheduleDto } from "../types/backups.types";

/**
 * Backup-schedule server state (E27-S4). Folds the god-page's
 * `fetchSchedule()`-not-in-deps staleness into a proper query (AC-8). The lib fn
 * THROWS when no schedule exists yet; the god-page swallowed that ("not critical"),
 * so `retry: false` + a degrade to a disabled schedule keeps the same UX (no error
 * banner for a missing schedule).
 */
export function useBackupSchedule(enabled: boolean) {
  const { accessToken } = useAuth();
  return useQuery<BackupScheduleDto>({
    queryKey: backupsKeys.schedule(),
    queryFn: async () => {
      try {
        return await fetchBackupSchedule(accessToken ?? "");
      } catch {
        // No schedule configured yet — not critical (god-page parity).
        return { enabled: false, cronExpression: null };
      }
    },
    enabled: enabled && !!accessToken,
    retry: false,
  });
}

/** Set the schedule cron; refresh the schedule query on success. */
export function useSetBackupSchedule() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<BackupScheduleDto, Error, string>({
    mutationFn: (cronExpression) =>
      putBackupSchedule(accessToken ?? "", cronExpression),
    onSuccess: (data) => {
      queryClient.setQueryData(backupsKeys.schedule(), data);
    },
  });
}

/** Disable the schedule; refresh the schedule query on success. */
export function useDisableBackupSchedule() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<BackupScheduleDto, Error, void>({
    mutationFn: () => deleteBackupSchedule(accessToken ?? ""),
    onSuccess: (data) => {
      queryClient.setQueryData(backupsKeys.schedule(), data);
    },
  });
}
