"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import {
  adminSettingsKeys,
  createCustomRole,
  deleteCustomRole,
  updateCustomRole,
} from "../api/admin-settings-api";
import type {
  CreateCustomRoleRequest,
  UpdateCustomRoleRequest,
} from "../types/admin-settings.types";

/**
 * Custom-role write mutations (E27-S3, A79). Each throws on `result.error` so the
 * content surfaces the persistent `roleError` banner (god-page parity), and each
 * invalidates `adminSettingsKeys.customRoles` on success — replacing the god-page's
 * manual `loadRoles()` refetch after every create / update / delete.
 *
 * `useCreateRole` POSTs the create subset (no `isActive`); `useUpdateRole` PUTs the
 * full form; `useDeleteRole` issues the DELETE. None couple to `AppSettingsProvider`
 * (roles are not part of the global settings, unlike branding / modules).
 */
export function useCreateRole() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateCustomRoleRequest) => {
      const result = await createCustomRole(api, body);
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: adminSettingsKeys.customRoles,
      }),
  });
}

export function useUpdateRole() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; body: UpdateCustomRoleRequest }) => {
      const result = await updateCustomRole(api, vars.id, vars.body);
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: adminSettingsKeys.customRoles,
      }),
  });
}

export function useDeleteRole() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteCustomRole(api, id);
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: adminSettingsKeys.customRoles,
      }),
  });
}
