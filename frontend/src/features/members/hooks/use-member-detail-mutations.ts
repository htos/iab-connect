"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import {
  membersKeys,
  updateMemberStatus,
  updateMemberType,
} from "../api/members-api";
import type {
  MemberDto,
  MembershipStatus,
  MembershipType,
} from "../types/member.types";

/**
 * Detail-page quick actions: status change + type change. Each endpoint returns
 * the updated `MemberDto`; on success we write it straight into the detail query
 * cache via `setQueryData` — preserving the god-page's "the mutation response
 * replaces the view, no extra GET" semantics (A79). Each mutation throws on API
 * error so the caller `alert()`s, exactly like the god-page (the status/type
 * error mechanism is NOT licensed to change — only delete moves to a dialog).
 */
export function useMemberDetailMutations(id: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();

  const writeDetail = (data: MemberDto | null) => {
    if (data) queryClient.setQueryData(membersKeys.detail(id), data);
  };

  const changeStatus = useMutation({
    mutationFn: async (status: MembershipStatus) => {
      const result = await updateMemberStatus(api, id, status);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: writeDetail,
  });

  const changeType = useMutation({
    mutationFn: async (membershipType: MembershipType) => {
      const result = await updateMemberType(api, id, membershipType);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: writeDetail,
  });

  return { changeStatus, changeType };
}
