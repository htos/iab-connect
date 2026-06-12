"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  deleteEmailTemplate,
  emailTemplatesKeys,
} from "../api/email-templates-api";

/**
 * Delete mutation for an email template (E25-S4, DEC-4 + A79). The god-page deleted
 * via a native `confirm()` then removed the row with `templates.filter(...)` ONLY
 * on success (failure left the list unchanged + set the error banner). Preserved by
 * a TanStack mutation that, on SUCCESS, invalidates the list root (the item
 * disappears on refetch) and, on FAILURE, throws so the list content's `onError`
 * surfaces the message and the cache is NOT mutated (the item stays). The wrapped
 * lib fn already throws an `ApiError` on non-ok. `EmailTemplate.id` is numeric.
 */
export function useDeleteEmailTemplate() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteEmailTemplate(accessToken ?? "", id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: emailTemplatesKeys.all }),
  });
}
