"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import {
  emailCampaignsKeys,
  getEmailCampaign,
} from "../api/email-campaigns-api";

/**
 * Sentinel error so the detail component can distinguish a 404 (the dedicated
 * not-found view) from a generic failure, mirroring `BoardDocumentNotFoundError`
 * (A93). UNLIKE the automations sibling (E25-S2, whose wrapped lib fn carried no
 * status), `useApiClient` returns `{ status }`, so here a REAL 404 sentinel IS
 * feasible — the queryFn throws this on `status === 404` and a generic Error
 * otherwise. Either way the god-page rendered the same not-found surface (it set
 * `campaign = null` on the first failed GET).
 */
export class EmailCampaignNotFoundError extends Error {
  constructor() {
    super("notFound");
    this.name = "EmailCampaignNotFoundError";
  }
}

/**
 * Email-campaign detail server state (E25-S3, A93). `api.get` returns
 * `{ data, error, status }`; a 404 throws `EmailCampaignNotFoundError`, any other
 * failure throws a generic Error. `retry` excludes the sentinel so the not-found
 * view renders immediately (god-page parity: it set `campaign = null` on the
 * first failed GET, no second fetch) while a generic error still gets one retry
 * (the provider default `retry: 1`, mirrored here). `enabled` mirrors the page's
 * `accessToken && (isVorstand || isAdmin)` gate.
 */
export function useEmailCampaign(id: string, enabled: boolean) {
  const api = useApiClient();
  return useQuery({
    queryKey: emailCampaignsKeys.detail(id),
    queryFn: async () => {
      const result = await getEmailCampaign(api, id);
      if (result.status === 404) throw new EmailCampaignNotFoundError();
      if (result.error || !result.data)
        throw new Error(result.error ?? "notFound");
      return result.data;
    },
    enabled: enabled && !!id,
    retry: (failureCount, error) =>
      !(error instanceof EmailCampaignNotFoundError) && failureCount < 1,
  });
}
