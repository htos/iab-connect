"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import {
  emailCampaignsKeys,
  updateEmailCampaign,
} from "../api/email-campaigns-api";
import type { UpdateEmailCampaignRequest } from "../types/email-campaign.types";

/**
 * Update mutation for an email campaign (form sub-recipe, E25-S3). Throws on API
 * error so the form banner can surface `mutation.error.message` (the god-page's
 * `setError`). Invalidates the list root + the edited campaign's detail on success
 * so the detail view reflects the change after the redirect (A79).
 */
export function useUpdateEmailCampaign() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string;
      body: UpdateEmailCampaignRequest;
    }) => {
      const result = await updateEmailCampaign(api, vars.id, vars.body);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: emailCampaignsKeys.all });
      queryClient.invalidateQueries({
        queryKey: emailCampaignsKeys.detail(vars.id),
      });
    },
  });
}
