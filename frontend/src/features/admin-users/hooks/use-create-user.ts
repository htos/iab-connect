"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { adminUsersKeys, createUserRequest } from "../api/admin-users-api";
import type { CreateUserRequest, User } from "../types/admin-user.types";

/**
 * Create a user. Wraps the raw-fetch `createUser` (A94) so the create 409 →
 * "A user with this email already exists" message surfaces verbatim to the
 * content's error banner. Invalidates the admin-users root on success.
 */
export function useCreateUser() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<User, Error, CreateUserRequest>({
    mutationFn: (body) => createUserRequest(accessToken ?? "", body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: adminUsersKeys.all }),
  });
}
