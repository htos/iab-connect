"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { sponsorsKeys, updateSponsor } from "../api/sponsors-api";
import type { UpdateSponsorRequest } from "../types/sponsor.types";

/**
 * Update mutation for a sponsor (form sub-recipe, E22-S3). Throws on API error
 * for the form banner; invalidates both the detail and the list on success.
 */
export function useUpdateSponsor(id: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateSponsorRequest) => {
      const result = await updateSponsor(api, id, body);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sponsorsKeys.all });
      queryClient.invalidateQueries({ queryKey: sponsorsKeys.detail(id) });
    },
  });
}
