"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import {
  emailCampaignsKeys,
  getCampaignRecipients,
} from "../api/email-campaigns-api";

/**
 * Campaign recipients server state (E25-S3, A79). On the god-page this was a
 * branch of the parallel load that only set `recipients` when `recipientsRes.ok`.
 * Here it is its own query that returns `[]` on any error/empty response — so the
 * recipients table renders only when `recipients.length > 0`, matching the
 * god-page. `enabled` mirrors the detail query gate.
 */
export function useCampaignRecipients(id: string, enabled: boolean) {
  const api = useApiClient();
  return useQuery({
    queryKey: emailCampaignsKeys.recipients(id),
    queryFn: async () => {
      const result = await getCampaignRecipients(api, id);
      if (result.error || !result.data) return [];
      return result.data.items;
    },
    enabled: enabled && !!id,
  });
}
