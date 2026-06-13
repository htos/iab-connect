"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { adminUsersKeys, fetchAvailableRoles } from "../api/admin-users-api";

/**
 * The list of assignable roles for the create/edit role checkboxes. Keyed under
 * the DISTINCT `roles` key (not `detail("roles")`) so it never collides with a
 * `getUser` cache entry. `enabled` mirrors the page's admin gate.
 */
export function useAvailableRoles(enabled: boolean) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: adminUsersKeys.roles(),
    queryFn: () => fetchAvailableRoles(accessToken ?? ""),
    enabled,
  });
}
