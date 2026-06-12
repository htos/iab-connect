"use client";

import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { fetchRecipientPreview } from "../api/automations-api";
import type {
  PreviewRequest,
  RecipientPreviewDto,
} from "../types/automation.types";

/**
 * Recipient-preview action (E25-S2). The god-page's "Preview recipients" button
 * is a transient, on-demand request (not cached server state), so it's modelled
 * as a mutation: the form calls it and reads `data` (the count + sample) /
 * `error` (surfaced in the form banner, mirroring the god-page `setError`).
 */
export function useRecipientPreview() {
  const { accessToken } = useAuth();
  return useMutation<RecipientPreviewDto, Error, PreviewRequest>({
    mutationFn: (body: PreviewRequest) =>
      fetchRecipientPreview(accessToken ?? "", body),
  });
}
