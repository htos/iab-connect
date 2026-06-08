"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { fetchMembers, membersKeys } from "../api/members-api";
import type { ListMembersArgs } from "../api/members-api";

/**
 * Server state for the Members list. Server-side search/status/type/page are all
 * part of the key (S2-DEC-4), so TanStack refetches as any changes — preserving
 * the god-page's server-side search. `enabled` mirrors the page's
 * Vorstand/Admin gate so no fetch fires for the unauthorized.
 */
export function useMembers(args: ListMembersArgs, enabled: boolean) {
  const api = useApiClient();
  return useQuery({
    queryKey: membersKeys.list(args.status, args.type, args.search, args.page),
    queryFn: async () => {
      const result = await fetchMembers(api, args);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    enabled,
  });
}
