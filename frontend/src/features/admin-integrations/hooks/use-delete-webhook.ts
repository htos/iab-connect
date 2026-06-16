"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { webhooksKeys, deleteWebhook } from "../api/webhooks-api";

/**
 * Delete-webhook mutation (E27-S5, A79). DELETE `${BASE}/{id}`. Throws on API error
 * so the content component surfaces the error banner AND does NOT invalidate the
 * list (the failure branch issues NO refetch; pinned by S1). On success invalidates
 * the list. The `window.confirm` gate stays in the component (DEC-3 = A).
 */
export function useDeleteWebhook() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteWebhook(api, id);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: webhooksKeys.list() }),
  });
}
