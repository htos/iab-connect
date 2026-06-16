"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { fetchMember, membersKeys } from "../api/members-api";

/**
 * Sentinel so the detail component renders the dedicated `members.memberNotFound`
 * view for a 404 (vs the generic full-page error), preserving the god-page's
 * two-branch error UI (A79). Mirrors `SupplierNotFoundError`.
 */
export class MemberNotFoundError extends Error {
  constructor() {
    super("members.memberNotFound");
    this.name = "MemberNotFoundError";
  }
}

export function useMember(id: string, enabled: boolean) {
  const api = useApiClient();
  return useQuery({
    queryKey: membersKeys.detail(id),
    queryFn: async () => {
      const result = await fetchMember(api, id);
      if (result.status === 404) throw new MemberNotFoundError();
      if (result.error) throw new Error(result.error);
      return result.data!;
    },
    enabled: enabled && !!id,
  });
}
