"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  postEnforceRetention,
  putRetentionPolicy,
  retentionKeys,
} from "../api/retention-api";
import type {
  RetentionPolicyDto,
  UpdateRetentionPolicyRequest,
} from "../types/retention.types";

export interface UpdateRetentionArgs {
  id: string;
  data: UpdateRetentionPolicyRequest;
}

/**
 * Update a retention policy (E27-S4, A79). Invalidates `retentionKeys.all` on
 * success, replacing the god-page's manual `fetchPolicies()` re-run after a save.
 * The component owns the 5s success toast + edit-mode exit.
 */
export function useUpdateRetention() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<RetentionPolicyDto, Error, UpdateRetentionArgs>({
    mutationFn: ({ id, data }) =>
      putRetentionPolicy(accessToken ?? "", id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: retentionKeys.all });
    },
  });
}

/**
 * Manually enforce retention (E27-S4, A79). NO confirm (god-page parity), orange
 * affordance owned by the component. Returns the processed-record count for the
 * success toast. Does NOT invalidate the policy list (enforce does not change the
 * policy definitions).
 */
export function useEnforceRetention() {
  const { accessToken } = useAuth();
  return useMutation<{ processedRecords: number }, Error, void>({
    mutationFn: () => postEnforceRetention(accessToken ?? ""),
  });
}
