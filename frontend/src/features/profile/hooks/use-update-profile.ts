"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { updateMyProfile, profileKeys } from "../api/profile-api";
import type {
  MemberDto,
  UpdateOwnProfileRequest,
} from "../types/profile.types";

/**
 * Update the caller's own profile (E29-S4, form sub-recipe). Throws on API error
 * so the form banner can show `mutation.error.message` (the god-page `setError`
 * behaviour).
 *
 * A79 (behaviour-preserving): the god-page set `member` directly from the PUT
 * RESPONSE and never refetched. We mirror that by seeding the `profileKeys.me`
 * cache with the response member via `setQueryData` and DELIBERATELY NOT
 * invalidating — a refetch would re-fetch the stale GET payload (in tests that
 * still returns the pre-edit member) and clobber the just-saved record (an A79
 * delta we avoid). The PUT response IS the new truth.
 */
export function useUpdateProfile() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateOwnProfileRequest) => {
      const result = await updateMyProfile(api, body);
      if (result.error || !result.data)
        throw new Error(result.error || "error.savingError");
      return result.data;
    },
    onSuccess: (updated: MemberDto) => {
      queryClient.setQueryData(profileKeys.me(), updated);
    },
  });
}
