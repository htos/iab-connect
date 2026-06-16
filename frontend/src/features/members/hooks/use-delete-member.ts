"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { deleteMember, membersKeys } from "../api/members-api";

/**
 * Delete a member. On success it invalidates the `all` members root, refetching
 * both the list and the statistics (the god-page called fetchMembers +
 * fetchStatistics after a delete). Throws on API error so the caller surfaces it
 * (list: error banner; detail: stays on page).
 */
export function useDeleteMember() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteMember(api, id);
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: membersKeys.all }),
  });
}
