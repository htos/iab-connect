"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import {
  cancelCampaign,
  emailCampaignsKeys,
  resendCampaign,
  scheduleCampaign,
  sendCampaign,
  sendTestEmail,
} from "../api/email-campaigns-api";

/**
 * The 5 detail status-machine actions for an email campaign (E25-S3, DEC-4 = A,
 * A79). Each is its own TanStack mutation wrapping an `api.post` (which returns
 * `{ data, error, status }`, never throws); each throws on `result.error` so the
 * detail component's `onError` can `alert(...)` the god-page failure key
 * (test → testEmailFailed, schedule → scheduleFailed, send → sendFailed,
 * cancel → cancelFailed, resend → resendFailed) and `onSuccess` can run the
 * god-page side-effect (test alerts + closes its modal; schedule/cancel/resend
 * close their modal; all refetch).
 *
 * Invalidation (A79 delta from the god-page's `fetchCampaign()` re-load of all 3
 * surfaces): every status-changing action (schedule/send/cancel/resend) invalidates
 * `detail(id)` + `statistics(id)` + `recipients(id)` + `all` (the list status
 * changes too). `test` does NOT change campaign state, so it invalidates nothing —
 * the god-page's `/test` handler did not call `fetchCampaign()` either (it only
 * alerted + closed the modal). The native `confirm()` gates on send/cancel and the
 * test/schedule/resend MODALS live in the component (A86 — no new dialog primitive).
 */
export function useCampaignActions(id: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();

  const refetchAll = () => {
    queryClient.invalidateQueries({ queryKey: emailCampaignsKeys.detail(id) });
    queryClient.invalidateQueries({
      queryKey: emailCampaignsKeys.statistics(id),
    });
    queryClient.invalidateQueries({
      queryKey: emailCampaignsKeys.recipients(id),
    });
    queryClient.invalidateQueries({ queryKey: emailCampaignsKeys.all });
  };

  const test = useMutation({
    mutationFn: async (testEmail: string) => {
      const result = await sendTestEmail(api, id, { testEmail });
      if (result.error) throw new Error(result.error);
    },
  });

  const schedule = useMutation({
    mutationFn: async (scheduledAt: string) => {
      const result = await scheduleCampaign(api, id, { scheduledAt });
      if (result.error) throw new Error(result.error);
    },
    onSuccess: refetchAll,
  });

  const send = useMutation({
    mutationFn: async () => {
      const result = await sendCampaign(api, id);
      if (result.error) throw new Error(result.error);
    },
    onSuccess: refetchAll,
  });

  const cancel = useMutation({
    mutationFn: async () => {
      const result = await cancelCampaign(api, id);
      if (result.error) throw new Error(result.error);
    },
    onSuccess: refetchAll,
  });

  const resend = useMutation({
    mutationFn: async (failedOnly: boolean) => {
      const result = await resendCampaign(api, id, failedOnly);
      if (result.error) throw new Error(result.error);
    },
    onSuccess: refetchAll,
  });

  return { test, schedule, send, cancel, resend };
}
