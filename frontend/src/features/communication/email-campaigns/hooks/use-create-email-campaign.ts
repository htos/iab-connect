"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import {
  createEmailCampaign,
  emailCampaignsKeys,
} from "../api/email-campaigns-api";
import type { CreateEmailCampaignRequest } from "../types/email-campaign.types";

/**
 * Create mutation for an email campaign (form sub-recipe, E25-S3). Throws on API
 * error so the form banner can show `mutation.error.message` (the god-page's
 * `setError` behaviour); returns the created DTO so the content component can
 * `router.push` to the new detail page. Invalidates the list on success so a
 * return to the list shows the new row (A79).
 */
export function useCreateEmailCampaign() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateEmailCampaignRequest) => {
      const result = await createEmailCampaign(api, body);
      if (result.error || !result.data)
        throw new Error(result.error ?? "Error");
      return result.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: emailCampaignsKeys.all }),
  });
}
