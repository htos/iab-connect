"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  emailTemplatesKeys,
  postEmailTemplate,
} from "../api/email-templates-api";
import type { CreateEmailTemplateRequest } from "../types/email-template.types";

/**
 * Create mutation for an email template (form sub-recipe, E25-S4). The wrapped lib
 * fn THROWS on a non-ok response, so the mutation rejects and the new-content
 * component can surface the error (the god-page's `setError`). Invalidates the list
 * on success so a return to the list shows the new row (A79 — replacing the manual
 * refetch). Returns the created DTO.
 */
export function useCreateEmailTemplate() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateEmailTemplateRequest) =>
      postEmailTemplate(accessToken ?? "", body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: emailTemplatesKeys.all }),
  });
}
