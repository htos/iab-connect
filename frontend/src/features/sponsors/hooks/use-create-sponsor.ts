"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { createSponsor, sponsorsKeys } from "../api/sponsors-api";
import type { CreateSponsorRequest } from "../types/sponsor.types";

/**
 * Create mutation for a sponsor (form sub-recipe, E22-S3). Throws on API error so
 * the form banner can show `mutation.error.message` (the god-page `setError`
 * behaviour); invalidates the list on success so a return to `/sponsors` shows
 * the new row.
 */
export function useCreateSponsor() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateSponsorRequest) => {
      const result = await createSponsor(api, body);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: sponsorsKeys.all }),
  });
}
