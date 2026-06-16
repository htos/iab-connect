"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { apiClientsKeys, createApiClient } from "../api/api-clients-api";
import type {
  ApiClientCreatedDto,
  CreateApiClientRequest,
} from "../types/admin-integrations.types";

/**
 * Create-api-client mutation (E27-S5, A79). Throws on API error (or a missing data
 * body) so the create dialog can surface the error banner (god-page's
 * `setError(res.error ?? t("createFailed"))`). On success it RETURNS the created
 * DTO — the ONLY shape carrying the one-time cleartext secret — so the content
 * component stores it in local `createdSecret` panel state (data-loss invariant:
 * the secret lives ONLY there, never in server state). Invalidates the list so the
 * refetch lands the new row (which carries NO secret).
 */
export function useCreateApiClient() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      body: CreateApiClientRequest
    ): Promise<ApiClientCreatedDto> => {
      const result = await createApiClient(api, body);
      if (result.error || !result.data) throw new Error(result.error ?? "");
      return result.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: apiClientsKeys.list() }),
  });
}
