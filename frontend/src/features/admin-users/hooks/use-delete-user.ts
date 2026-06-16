"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { adminUsersKeys, deleteUserRequest } from "../api/admin-users-api";

/**
 * Delete a user. On success the content removes the row + decrements the count
 * locally (god-page parity); we also invalidate the admin-users root so a later
 * refetch re-reconciles. Throws on error so the content keeps the list intact
 * and surfaces the message in the banner (list NOT cleared on failure — A79).
 */
export function useDeleteUser() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (userId) => deleteUserRequest(accessToken ?? "", userId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: adminUsersKeys.all }),
  });
}
