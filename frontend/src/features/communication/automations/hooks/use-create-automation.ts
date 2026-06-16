"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { automationsKeys, postAutomation } from "../api/automations-api";
import type { AutomationWriteRequest } from "../types/automation.types";

/**
 * Create mutation for an automation (form sub-recipe, E25-S2). The wrapped lib fn
 * THROWS on a non-ok response, so the mutation rejects and the form banner can
 * show `mutation.error.message` (the god-page `setError` behaviour). Invalidates
 * the list on success so a return to the list shows the new row (A79 — replacing
 * the god-page's `refreshKey`).
 */
export function useCreateAutomation() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AutomationWriteRequest) =>
      postAutomation(accessToken ?? "", body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: automationsKeys.all }),
  });
}
