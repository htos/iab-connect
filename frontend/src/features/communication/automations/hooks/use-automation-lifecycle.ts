"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { automationsKeys, postAutomationStatus } from "../api/automations-api";
import type { AutomationDetailDto } from "../types/automation.types";

export type LifecycleAction = "activate" | "pause" | "resume" | "disable";

/**
 * Lifecycle mutation (activate/pause/resume/disable) for an automation
 * (E25-S2, A79). The wrapped lib fn returns the UPDATED detail DTO; on success we
 * write it straight into the `detail(id)` cache (so the detail view reflects the
 * new status immediately, mirroring the god-page's `setAutomation(updated)`) and
 * invalidate the list root so a return to the list reflects the change. Throws on
 * a non-ok response so the detail banner surfaces `mutation.error.message`
 * (NOT silently sticky) — the next successful action clears it.
 */
export function useAutomationLifecycle(id: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: LifecycleAction) =>
      postAutomationStatus(accessToken ?? "", id, action),
    onSuccess: (updated: AutomationDetailDto) => {
      queryClient.setQueryData(automationsKeys.detail(id), updated);
      queryClient.invalidateQueries({ queryKey: automationsKeys.all });
    },
  });
}
