"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { webhooksKeys, toggleWebhook } from "../api/webhooks-api";

/**
 * Toggle-webhook mutation (E27-S5, A79). POST `${BASE}/{id}/{enable|disable}` with
 * NO confirm gate (god-page parity — only delete is behind `window.confirm`). Throws
 * on API error so the content component surfaces the error banner AND — crucially —
 * does NOT invalidate the list (the failure branch issues NO refetch; pinned by S1).
 * On success invalidates the list. The caller derives the action from
 * `status === "Active" ? "disable" : "enable"`.
 */
export function useToggleWebhook() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      action,
    }: {
      id: string;
      action: "enable" | "disable";
    }) => {
      const result = await toggleWebhook(api, id, action);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: webhooksKeys.list() }),
  });
}
