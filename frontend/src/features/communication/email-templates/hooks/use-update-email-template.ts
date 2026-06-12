"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  emailTemplatesKeys,
  putEmailTemplate,
} from "../api/email-templates-api";
import type { UpdateEmailTemplateRequest } from "../types/email-template.types";

/**
 * Update mutation for an email template (form sub-recipe, E25-S4). The wrapped lib
 * fn THROWS on a non-ok response, so the mutation rejects and the edit-content
 * component can surface the error (the god-page's `setError`). Invalidates the list
 * root + the edited template's detail on success (A79).
 */
export function useUpdateEmailTemplate() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; body: UpdateEmailTemplateRequest }) =>
      putEmailTemplate(accessToken ?? "", vars.id, vars.body),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: emailTemplatesKeys.all });
      queryClient.invalidateQueries({
        queryKey: emailTemplatesKeys.detail(vars.id),
      });
    },
  });
}
