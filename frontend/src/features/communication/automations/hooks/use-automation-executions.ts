"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { automationsKeys, fetchExecutions } from "../api/automations-api";
import type { AutomationExecutionDto } from "../types/automation.types";

/**
 * Recent-executions server state (E25-S2). Preserves the god-page's
 * "executions error → no runs yet" behaviour: the queryFn SWALLOWS any failure
 * and resolves `[]`, so the panel degrades to the empty state (`noRunsYet`)
 * instead of surfacing an error. `enabled` mirrors the detail gate so executions
 * only load alongside the automation.
 */
export function useAutomationExecutions(id: string, enabled: boolean) {
  const { accessToken } = useAuth();
  return useQuery<AutomationExecutionDto[]>({
    queryKey: automationsKeys.executions(id),
    queryFn: async () => {
      try {
        return await fetchExecutions(accessToken ?? "", id);
      } catch {
        return [];
      }
    },
    enabled: enabled && !!accessToken && !!id,
    retry: false,
  });
}
