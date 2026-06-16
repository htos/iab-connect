"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { adminUsersKeys, listUsers } from "../api/admin-users-api";
import type { ListUsersArgs } from "../api/admin-users-api";

/**
 * Server state for the admin users list. Search + page are part of the key so
 * TanStack refetches as either changes (preserving the god-page's server-side
 * search/pagination). `enabled` mirrors the page's admin gate so no fetch fires
 * for the unauthorized. Wraps the token-param `listUsers` (A94) — the access
 * token comes from `useAuth`, not the `useApiClient` `{ data, error }` contract,
 * because the lib fn throws on error.
 */
export function useUsers(args: ListUsersArgs, enabled: boolean) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: adminUsersKeys.list(args.search, args.page),
    queryFn: () => listUsers(accessToken ?? "", args),
    enabled,
  });
}
