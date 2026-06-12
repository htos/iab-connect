"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { backupsKeys, fetchBackups } from "../api/backups-api";
import type { BackupDto } from "../types/backups.types";

/**
 * Backups list server state (E27-S4). The god-page loaded the whole list (no
 * server-side filter), so a flat list key. `retry: false` mirrors the god-page
 * (error on the first failed fetch). `enabled` mirrors the page's
 * `isAuthenticated && isAdmin && accessToken` gate.
 */
export function useBackups(enabled: boolean) {
  const { accessToken } = useAuth();
  return useQuery<BackupDto[]>({
    queryKey: backupsKeys.list(),
    queryFn: () => fetchBackups(accessToken ?? ""),
    enabled: enabled && !!accessToken,
    retry: false,
  });
}
