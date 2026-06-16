"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { createMember, membersKeys } from "../api/members-api";
import type { CreateMemberRequest, MemberDto } from "../types/member.types";

/**
 * Create a member. Wraps the raw-fetch `createMember` (S2-DEC-1 exception — it
 * preserves the 409 `existingMemberId` body the shared client discards), so the
 * mutation error is a `MemberConflictError` / `MemberSaveError` / generic Error
 * the content component maps to the duplicate-synthesis + banner behaviour.
 */
export function useCreateMember() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<MemberDto, Error, CreateMemberRequest>({
    mutationFn: (body) => createMember(accessToken ?? "", body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: membersKeys.all }),
  });
}
