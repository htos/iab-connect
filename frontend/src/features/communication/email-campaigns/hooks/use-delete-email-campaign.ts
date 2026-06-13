"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import {
  deleteEmailCampaign,
  emailCampaignsKeys,
} from "../api/email-campaigns-api";

/**
 * Delete mutation for an email campaign (E25-S3, A79). The god-page DELETE handler
 * `alert(server message || deleteError)` on failure then refetched the list on
 * success. Preserved by throwing on ANY failure (a non-null `error` OR a >= 400
 * status) carrying `result.error` (or `""` when the failure had no body) — the
 * list content's `onError` then alerts `err.message || t("deleteError")`,
 * reproducing the god-page's server-message-then-fallback behaviour. Invalidates
 * the list root on success (replacing the manual `fetchCampaigns()` refetch).
 */
export function useDeleteEmailCampaign() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteEmailCampaign(api, id);
      if (result.error || result.status >= 400) {
        throw new Error(result.error ?? "");
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: emailCampaignsKeys.all }),
  });
}
