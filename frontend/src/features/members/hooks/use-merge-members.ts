"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import {
  duplicateKeys,
  postMemberMerge,
  type PostMemberMergeArgs,
} from "../api/members-api";

/**
 * Submit a safe member-merge (Admin-only). On success it invalidates the
 * duplicate-groups root so the visible page refetches. Throws on API error so
 * the merge modal's catch surfaces the message.
 */
export function useMergeMembers() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: PostMemberMergeArgs) => {
      const result = await postMemberMerge(api, args);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: duplicateKeys.all }),
  });
}
