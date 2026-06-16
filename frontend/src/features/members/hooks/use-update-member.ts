"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { membersKeys, updateMember } from "../api/members-api";
import type { MemberDto, UpdateMemberRequest } from "../types/member.types";

/**
 * Update a member. Wraps the raw-fetch `updateMember` (S2-DEC-1 exception, same
 * 409 reason as create). Invalidates the list root + this member's detail on
 * success; the content component handles the 409/duplicate-synthesis on error.
 */
export function useUpdateMember(id: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<MemberDto, Error, UpdateMemberRequest>({
    mutationFn: (body) => updateMember(accessToken ?? "", id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membersKeys.all });
      queryClient.invalidateQueries({ queryKey: membersKeys.detail(id) });
    },
  });
}
