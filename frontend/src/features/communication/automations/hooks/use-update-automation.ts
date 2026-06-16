"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { automationsKeys, putAutomation } from "../api/automations-api";
import type { AutomationWriteRequest } from "../types/automation.types";

/**
 * Update mutation for an automation (form sub-recipe, E25-S2). Throws on a non-ok
 * response so the form banner shows `mutation.error.message`. Invalidates the
 * list root + the edited `detail(id)` on success so both the list and the detail
 * view reflect the change (A79).
 */
export function useUpdateAutomation() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AutomationWriteRequest }) =>
      putAutomation(accessToken ?? "", id, body),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: automationsKeys.all });
      queryClient.invalidateQueries({ queryKey: automationsKeys.detail(id) });
    },
  });
}
