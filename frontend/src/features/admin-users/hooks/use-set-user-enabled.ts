"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { adminUsersKeys, setEnabledRequest } from "../api/admin-users-api";
import type { User } from "../types/admin-user.types";

export interface SetUserEnabledVariables {
  userId: string;
  enabled: boolean;
}

/**
 * Enable/disable a user. Returns the updated user so the list can replace the
 * row in place (the god-page mapped the row to the response). Invalidates the
 * admin-users root on success; throws on error so the caller surfaces it in the
 * banner (the list is NOT cleared on failure — A79).
 */
export function useSetUserEnabled() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<User, Error, SetUserEnabledVariables>({
    mutationFn: ({ userId, enabled }) =>
      setEnabledRequest(accessToken ?? "", userId, enabled),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: adminUsersKeys.all }),
  });
}
