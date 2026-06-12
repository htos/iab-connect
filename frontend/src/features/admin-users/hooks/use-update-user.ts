"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  adminUsersKeys,
  fetchUser,
  rolesChanged,
  updateRolesRequest,
  updateUserRequest,
} from "../api/admin-users-api";
import type { UpdateUserRequest, User } from "../types/admin-user.types";

export interface UpdateUserVariables {
  details: UpdateUserRequest;
  // The roles currently stored on the user (the diff baseline).
  currentRoles: string[];
  // The roles selected in the form.
  nextRoles: string[];
}

/**
 * The two-step edit save (A79 — preserved verbatim from the god-page):
 *   1. `updateUser` (always),
 *   2. `updateUserRoles` ONLY when the role Set differs (`rolesChanged`),
 *   3. a `getUser` refresh so the form re-seeds from the server.
 * All three are awaited IN ORDER inside the mutationFn so the S1 net's ordering
 * (`updateUser` before `updateUserRoles`) and the post-save `getUser` refetch
 * (its call count grows) are deterministic. Returns the refreshed user. The
 * content shows a success banner and does NOT redirect (banner-only, A79).
 * Invalidates the admin-users root + this user's detail on success.
 */
export function useUpdateUser(id: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<User, Error, UpdateUserVariables>({
    mutationFn: async ({ details, currentRoles, nextRoles }) => {
      const token = accessToken ?? "";
      await updateUserRequest(token, id, details);
      if (rolesChanged(currentRoles, nextRoles)) {
        await updateRolesRequest(token, id, nextRoles);
      }
      return fetchUser(token, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUsersKeys.all });
      queryClient.invalidateQueries({ queryKey: adminUsersKeys.detail(id) });
    },
  });
}
