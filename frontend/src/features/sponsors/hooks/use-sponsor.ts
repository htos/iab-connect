"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { getSponsor, sponsorsKeys } from "../api/sponsors-api";

/**
 * Sentinel error so the detail component can show the dedicated
 * `sponsors.notFound` message for a 404 (vs a generic error), preserving the
 * god-page's two-branch error UI (A79).
 */
export class SponsorNotFoundError extends Error {
  constructor() {
    super("sponsors.notFound");
    this.name = "SponsorNotFoundError";
  }
}

/**
 * Detail server state (E22-S3, DEC-2=A — the detail page's first TanStack
 * adopter). `enabled` mirrors the `isAuthenticated && (isVorstand || isAdmin)`
 * gate so no GET fires for unauthorized users. A 404 throws `SponsorNotFoundError`
 * so the component renders `sponsors.notFound`.
 */
export function useSponsor(id: string, enabled: boolean) {
  const api = useApiClient();
  return useQuery({
    queryKey: sponsorsKeys.detail(id),
    queryFn: async () => {
      const result = await getSponsor(api, id);
      if (result.status === 404) throw new SponsorNotFoundError();
      if (result.error) throw new Error(result.error);
      return result.data!;
    },
    enabled: enabled && !!id,
  });
}
