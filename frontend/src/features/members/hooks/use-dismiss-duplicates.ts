"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import {
  buildCanonicalPairs,
  duplicateKeys,
  postDuplicateDismissal,
} from "../api/members-api";

interface DismissDuplicatesArgs {
  memberIds: string[];
  reason: string;
}

/**
 * Cascade-dismiss every C(N,2) canonical pair of a group in one action
 * (Promise.all — preserves the god-page's load-bearing "3 members → 3 POSTs"
 * behaviour). Each POST unwraps its result.error by throwing so the dismiss
 * modal's catch surfaces it. On success it invalidates the duplicate-groups root
 * so the visible page refetches.
 */
export function useDismissDuplicates() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberIds, reason }: DismissDuplicatesArgs) =>
      Promise.all(
        buildCanonicalPairs(memberIds).map(async (p) => {
          const result = await postDuplicateDismissal(api, {
            memberA: p.memberA,
            memberB: p.memberB,
            reason,
          });
          if (result.error) throw new Error(result.error);
          return result.data;
        })
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: duplicateKeys.all }),
  });
}
